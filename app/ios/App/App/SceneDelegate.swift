import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = YapstatsViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        ChatImport.removeLeftovers()
        importChat(from: connectionOptions.urlContexts)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if importChat(from: URLContexts) { return }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // MARK: - Chat export opened from another app's share sheet

    /// Takes the first chat export in `contexts` and hands it to the page. Returns true if one was found.
    @discardableResult
    private func importChat(from contexts: Set<UIOpenURLContext>) -> Bool {
        guard let url = contexts.map({ $0.url }).first(where: ChatImport.accepts),
              let copy = ChatImport.privateCopy(of: url) else { return false }
        deliver(copy, attempt: 0)
        return true
    }

    /// Runs the hand-off script until the page is ready (it may still be loading on a cold start),
    /// then deletes the private copy. The page keeps the chat in memory only, as on the website.
    private func deliver(_ copy: URL, attempt: Int) {
        let retry = { [weak self] in
            guard attempt < 60 else { ChatImport.remove(copy); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self?.deliver(copy, attempt: attempt + 1) }
        }
        guard let webView = (window?.rootViewController as? CAPBridgeViewController)?.webView else { retry(); return }

        let arguments: [String: Any] = [
            "path": copy.path,
            "name": copy.lastPathComponent,
            "type": ChatImport.mimeType(of: copy)
        ]
        webView.callAsyncJavaScript(ChatImport.handOffScript, arguments: arguments, in: nil, in: .page) { result in
            if case .success(let value) = result, let status = value as? String, status != "wait" {
                ChatImport.remove(copy)
            } else {
                retry()
            }
        }
    }
}

/// The app's web view. Same as Capacitor's, except that sub-pages get their own files.
final class YapstatsViewController: CAPBridgeViewController {
    override func router() -> Router { FolderRouter() }

    override func capacitorDidLoad() {
        // Same colour as the launch screen and the page, so launch, status bar and overscroll never flash.
        let background = UIColor(named: "LaunchBackground") ?? .systemBackground
        view.backgroundColor = background
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        // The page reaches native features with window.webkit.messageHandlers.yapstats.postMessage({ type }).
        webView?.configuration.userContentController.add(self, name: "yapstats")
    }
}

extension YapstatsViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        switch type {
        case "tick": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        default: break // "buy" arrives with the in-app purchase step
        }
    }
}

/// Capacitor treats every path without a file extension as a single-page-app route and serves the
/// home page. Yapstats has real sub-pages (/privacy/, /terms/, the export guides), so serve each
/// folder's own index.html and fall back to the home page only when there is none.
private struct FolderRouter: Router {
    var basePath = ""

    func route(for path: String) -> String {
        guard URL(fileURLWithPath: path).pathExtension.isEmpty else { return basePath + path }
        let page = basePath + (path.hasSuffix("/") ? path : path + "/") + "index.html"
        return FileManager.default.fileExists(atPath: page) ? page : basePath + "/index.html"
    }
}

/// A chat export shared into the app ("Open in Yapstats"). The file never leaves the device:
/// it is moved to a private temporary folder, read once by the bundled page, then deleted.
private enum ChatImport {
    private static let mimeTypes = ["zip": "application/zip", "txt": "text/plain", "json": "application/json"]
    private static let folder = FileManager.default.temporaryDirectory.appendingPathComponent("chat-import", isDirectory: true)

    static func accepts(_ url: URL) -> Bool {
        url.isFileURL && mimeTypes[url.pathExtension.lowercased()] != nil
    }

    static func mimeType(of url: URL) -> String {
        mimeTypes[url.pathExtension.lowercased()] ?? "application/octet-stream"
    }

    /// Moves (or copies, for a file outside the app) the export into the private import folder.
    static func privateCopy(of url: URL) -> URL? {
        let files = FileManager.default
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        try? files.removeItem(at: folder)
        do {
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            let copy = folder.appendingPathComponent(url.lastPathComponent)
            if url.deletingLastPathComponent().lastPathComponent == "Inbox" {
                try files.moveItem(at: url, to: copy)
            } else {
                try files.copyItem(at: url, to: copy)
            }
            return copy
        } catch {
            return nil
        }
    }

    static func remove(_ copy: URL) {
        try? FileManager.default.removeItem(at: copy)
    }

    /// Deletes anything a previous run left behind, including the system's Documents/Inbox copies.
    static func removeLeftovers() {
        let files = FileManager.default
        try? files.removeItem(at: folder)
        if let documents = files.urls(for: .documentDirectory, in: .userDomainMask).first {
            try? files.removeItem(at: documents.appendingPathComponent("Inbox", isDirectory: true))
        }
    }

    /// Body of an async function with `path`, `name` and `type` in scope. Puts the export into the page's
    /// own file input, so the page handles it exactly like a file picked by hand.
    /// Returns "wait" until the page is ready, then "ok" or "unreadable".
    static let handOffScript = #"""
        const input = document.getElementById('file');
        const landing = document.getElementById('landing');
        if (document.readyState !== 'complete' || !input || !landing || !window.Capacitor) return 'wait';
        if (landing.hidden) {
            if (!window.yapstatsRestarting) { window.yapstatsRestarting = true; location.reload(); }
            return 'wait';
        }
        const response = await fetch(window.Capacitor.convertFileSrc(path)).catch(() => null);
        if (!response || !response.ok) return 'unreadable';
        const file = new File([await response.blob()], name, { type });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
        """#
}
