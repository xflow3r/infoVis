
document.addEventListener("DOMContentLoaded", function() {
    var isFirefox = typeof InstallTrigger !== 'undefined';

    if (isFirefox) {
        var warningMessage = document.createElement('div');
        warningMessage.style.position = 'fixed';
        warningMessage.style.top = '0';
        warningMessage.style.width = '100%';
        warningMessage.style.backgroundColor = 'yellow';
        warningMessage.style.color = 'black';
        warningMessage.style.textAlign = 'center';
        warningMessage.style.padding = '1em';
        warningMessage.style.zIndex = '1000';
        warningMessage.textContent = 'Warning: You are using Firefox. Some features may not work as expected.';

        document.body.appendChild(warningMessage);
    }
});