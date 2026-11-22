// jsdom does not implement HTMLDialogElement.showModal() or close(). This gives it enough of both for
// tests: a modal dialog opens, takes focus, closes on Escape (a cancelable "cancel" event first, as
// in a browser), and gives focus back. It is for tests only and is not exported from the barrel.
//
//   import { installDialogShim } from '../design/dialog-shim.ts';
//   beforeAll(installDialogShim);

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function installDialogShim(): void {
  const proto = window.HTMLDialogElement.prototype;
  if (typeof proto.showModal === 'function') return;
  const openers = new WeakMap<HTMLDialogElement, HTMLElement | null>();

  proto.showModal = function showModal(this: HTMLDialogElement) {
    if (this.hasAttribute('open')) return;
    openers.set(
      this,
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    this.setAttribute('open', '');
    (
      this.querySelector<HTMLElement>('[autofocus]') ??
      this.querySelector<HTMLElement>(FOCUSABLE) ??
      this
    ).focus();
  };
  proto.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    if (returnValue !== undefined) this.returnValue = returnValue;
    const opener = openers.get(this);
    if (opener?.isConnected) opener.focus();
    this.dispatchEvent(new Event('close'));
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // The picture a closing dialog leaves behind to fade out is not a dialog anyone can reach.
    const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]:not([data-picture])');
    const top = open[open.length - 1];
    if (!top) return;
    const cancel = new Event('cancel', { cancelable: true });
    top.dispatchEvent(cancel);
    if (!cancel.defaultPrevented) top.close();
  });
}
