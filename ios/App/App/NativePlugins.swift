import Foundation
import AVFoundation
import MediaPlayer
import StoreKit
import Capacitor

/// 根畫面：載入後註冊 App 內建的本地外掛（SceneDelegate 會使用這個類別）
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorePlugin())
        bridge?.registerPluginInstance(BackgroundAudioPlugin())
    }
}

/// App 內購買外掛（StoreKit 2）：查詢商品、購買、恢復購買、查詢已擁有的商品
/// JS 端對應 store.js（window.Capacitor.Plugins.Store）。交易由 StoreKit 2 在裝置上驗證，不需要自己的伺服器。
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
    ]

    private var updatesTask: Task<Void, Never>?

    /// 監聽 App 外發生的交易（家長同意、退款、其他裝置購買），有變動就通知 JS
    override public func load() {
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                }
                let ids = await StorePlugin.ownedProductIds()
                self?.notifyListeners("entitlementsChanged", data: ["productIds": ids])
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    /// 目前擁有（已驗證、未退款）的商品 ID
    static func ownedProductIds() async -> [String] {
        var ids: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.revocationDate == nil {
                ids.append(transaction.productID)
            }
        }
        return ids
    }

    /// 查詢商品：{ productIds: [String] } → { products: [{ id, displayName, description, displayPrice }] }
    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { [
                    "id": $0.id,
                    "displayName": $0.displayName,
                    "description": $0.description,
                    "displayPrice": $0.displayPrice,
                ] }])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// 購買：{ productId } → { status: purchased | cancelled | pending | failed }
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId") else {
            call.reject("缺少 productId")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("找不到商品 \(id)")
                    return
                }
                switch try await product.purchase() {
                case .success(.verified(let transaction)):
                    await transaction.finish()
                    call.resolve(["status": "purchased"])
                case .success(.unverified):
                    call.resolve(["status": "failed"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"]) // 例如「詢問後購買」等家長同意
                @unknown default:
                    call.resolve(["status": "failed"])
                }
            } catch {
                call.resolve(["status": "failed"])
            }
        }
    }

    /// 恢復購買：向 App Store 同步後回傳擁有的商品 → { productIds }
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            try? await AppStore.sync() // 使用者取消 Apple ID 登入時會丟錯，仍回傳目前已知的結果
            call.resolve(["productIds": await StorePlugin.ownedProductIds()])
        }
    }

    /// 查詢擁有的商品（離線也可，StoreKit 會使用快取）→ { productIds }
    @objc func getEntitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(["productIds": await StorePlugin.ownedProductIds()])
        }
    }
}

/// 背景播放外掛：跟 Android 的 BackgroundAudio 同名同方法（start / stop / 'stop' 事件）。
/// 播放時把音訊工作階段設為 playback（關螢幕、靜音開關都不影響），並在鎖定畫面顯示正在播放；
/// 使用者在鎖定畫面或控制中心按暫停時，通知 JS 停止聲音。需要 Info.plist 的 UIBackgroundModes = audio。
@objc(BackgroundAudioPlugin)
public class BackgroundAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackgroundAudioPlugin"
    public let jsName = "BackgroundAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var commandsReady = false

    @objc func start(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "靜心時光"
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [])
                try session.setActive(true)
            } catch {
                call.reject(error.localizedDescription)
                return
            }
            self.setupCommands()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = [
                MPMediaItemPropertyTitle: text.isEmpty ? title : text,
                MPMediaItemPropertyArtist: title,
                MPNowPlayingInfoPropertyPlaybackRate: 1.0,
            ]
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve()
        }
    }

    /// 鎖定畫面／控制中心的暫停與播放鍵：暫停時請 JS 停止聲音（JS 會再呼叫 stop）
    private func setupCommands() {
        if commandsReady { return }
        commandsReady = true
        let center = MPRemoteCommandCenter.shared()
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.playCommand.isEnabled = false
        let pause: (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus = { [weak self] _ in
            self?.notifyListeners("stop", data: [:])
            return .success
        }
        center.pauseCommand.addTarget(handler: pause)
        center.togglePlayPauseCommand.addTarget(handler: pause)
    }
}
