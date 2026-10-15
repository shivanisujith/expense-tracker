// For tests only. jsdom (the test browser) has no popup support, so this
// gives <dialog> the two methods the app uses, behaving like a browser:
// showModal() opens it, close() closes it and sends a "close" event.
// Pressing Escape is tested by sending the "cancel" event the browser sends.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
