/// <reference path="node_modules/@beckhoff/tc-ui-client-ext/renderer.d.ts"/>

(function () {
    window.addEventListener("load", () => {
        for (const iframe of document.querySelectorAll("iframe")) {
            iframe.addEventListener(
                "load",
                (event) => handleIframeAddedOrLoaded(event.target),
                { passive: true, capture: false }
            );

            if (iframe.contentDocument) {
                addEventListeners(iframe.contentDocument);
            }
        }

        const mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const added of mutation.addedNodes) {
                    if (added.tagName?.toUpperCase() === "IFRAME") {
                        handleIframeAddedOrLoaded(added);
                    }
                }

                for (const removed of mutation.removedNodes) {
                    if (removed.tagName?.toUpperCase() === "IFRAME" && removed.contentDocument) {
                        removeEventListeners(removed.contentDocument);
                    }
                }
            }
        });

        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }, { once: true });

    addEventListeners(window);

    let ignoreFocusIn = false;

    const pressedKeys = new Set();
    let closeKeyboardOnKeyUp = false;

    // The "focus" event, in contrast to the "focusin" event, does not bubble, so registering it on window means it will
    // only be triggered if the actual window gains focus, not if an input inside the window gains focus.
    window.addEventListener("focus", () => {
        // Ignore focusin events that happen just because the window is focused. The keyboard should not be opened or
        // closed due to window focus changes.
        ignoreFocusIn = true;
        requestAnimationFrame(() => {
            ignoreFocusIn = false;
        });
    });

    function onFocusIn(event) {
        if (ignoreFocusIn) {
            return;
        }

        if (!isSuitableElement(event.target)) {
            return;
        }

        closeKeyboardOnKeyUp = false;
        tcuiclient.postMessage(`${__extensionName}.openOnscreenKeyboard`, { reason: "focusIn" });
    }

    function onFocusOut(event) {
        if (isSuitableElement(event.relatedTarget)) {
            // Don't close keyboard if focus will switch to another suitable input element
            return;
        }

        if (document.hasFocus()) {
            if (pressedKeys.size === 0) {
                // Only close keyboard if the electron window has focus, to prevent closing the keyboard when it has
                // focus
                tcuiclient.postMessage(`${__extensionName}.closeOnscreenKeyboard`, { reason: "focusOut" });
            } else {
                closeKeyboardOnKeyUp = true;
            }
        }
    }

    function onKeyDown(event) {
        pressedKeys.add(event.code);
    }

    function onKeyUp(event) {
        pressedKeys.delete(event.code);

        if (closeKeyboardOnKeyUp && pressedKeys.size === 0) {
            // Delayed close of keyboard because during focusout there were still some keys pressed
            tcuiclient.postMessage(`${__extensionName}.closeOnscreenKeyboard`, { reason: "focusOut" });
            closeKeyboardOnKeyUp = false;
        }
    }

    function isSuitableElement(element) {
        if (!element || !("tagName" in element)) {
            return false;
        }

        if (
            // Check tag name instead of instanceof so it works with elements in iFrames
            !(element.tagName.toUpperCase() === "TEXTAREA" || element.tagName.toUpperCase() === "INPUT")
        ) {
            return false;
        }

        if (
            // Disallow input types that don't accept text input
            element.tagName.toUpperCase() === "INPUT" &&
            [
                "button",
                "checkbox",
                "color",
                "file",
                "image",
                "radio",
                "range",
                "reset",
                "submit"
            ].includes(element.type)
        ) {
            return false;
        }

        return true;
    }

    function addEventListeners(target) {
        target.addEventListener("focusin", onFocusIn);
        target.addEventListener("focusout", onFocusOut);
        target.addEventListener("keydown", onKeyDown);
        target.addEventListener("keyup", onKeyUp);
    }

    function removeEventListeners(target) {
        target.removeEventListener("focusin", onFocusIn);
        target.removeEventListener("focusout", onFocusOut);
        target.removeEventListener("keydown", onKeyDown);
        target.removeEventListener("keyup", onKeyUp);
    }

    function handleIframeAddedOrLoaded(iframe) {
        if (iframe.contentDocument) {
            addEventListeners(iframe.contentDocument);
        }
    }
})();