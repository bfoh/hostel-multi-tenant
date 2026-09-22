import Capacitor
import WebKit

/// Injects the app's own bootstrap script (main.js, built from
/// apps/mobile/src/main.ts) into whatever page the WKWebView loads.
///
/// capacitor.config.ts sets `server.url` to the live portal, which makes
/// CAPBridgeViewController load that remote URL directly — the local
/// webDir's index.html (the only place main.js was ever <script>-referenced)
/// is never actually loaded, so main.js's boot logic (biometric gate, push
/// registration, role-based routing, deep-link handling, theme caching)
/// never ran in production. Capacitor's own bridge JS reaches remote pages
/// the same way it needs to: injected as a WKUserScript, independent of
/// which URL actually loads (see CapacitorBridge.exportCoreJS in the
/// Capacitor pod). This mirrors that for our own script.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard
            let scriptURL = Bundle.main.url(forResource: "main", withExtension: "js", subdirectory: "public"),
            let source = try? String(contentsOf: scriptURL, encoding: .utf8)
        else {
            assertionFailure("MainViewController: could not load public/main.js from the app bundle")
            return
        }

        let script = WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        webView?.configuration.userContentController.addUserScript(script)
    }
}
