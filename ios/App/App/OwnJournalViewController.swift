import UIKit
import Capacitor

class OwnJournalViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        let paperColor = UIColor(red: 249/255, green: 248/255, blue: 245/255, alpha: 1.0)

        // Set matching background on all layers
        view.backgroundColor = paperColor
        webView?.backgroundColor = paperColor
        webView?.scrollView.backgroundColor = paperColor
        webView?.isOpaque = false

        // Disable overscroll bounce so no gap is revealed when dragging down
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
    }
}
