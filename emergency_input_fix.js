// Emergency JavaScript to fix input fields if they're being blocked
// This script should be injected into the browser console

console.log('🔧 Emergency Input Fix Script Running...');

// Remove any CSS that might be blocking inputs
function fixInputStyles() {
    const style = document.createElement('style');
    style.textContent = `
        input, input[type="email"], input[type="password"], input[type="text"] {
            pointer-events: auto !important;
            user-select: auto !important;
            -webkit-user-select: auto !important;
            -moz-user-select: auto !important;
            cursor: text !important;
            opacity: 1 !important;
            background: white !important;
            color: black !important;
            z-index: 999999 !important;
            position: relative !important;
        }
        
        input:focus {
            outline: 2px solid blue !important;
            background: white !important;
        }
        
        /* Override any potential blocking overlays */
        .beacon-highlighter,
        .beacon-hover-highlighter,
        .beacon-selected-highlighter {
            pointer-events: none !important;
            z-index: -1 !important;
        }
    `;
    document.head.appendChild(style);
    console.log('✅ Emergency CSS fixes applied');
}

// Remove any event listeners that might be blocking input
function removeBlockingListeners() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        // Clone node to remove all event listeners
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        // Re-add basic functionality
        newInput.addEventListener('focus', () => console.log('Input focused:', newInput.placeholder));
        newInput.addEventListener('input', (e) => console.log('Input value:', e.target.value));
    });
    console.log('✅ Event listeners cleaned up');
}

// Check for React form issues
function checkReactForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        console.log('Form found:', form);
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            console.log('Input in form:', {
                type: input.type,
                placeholder: input.placeholder,
                disabled: input.disabled,
                readOnly: input.readOnly,
                style: input.style.cssText
            });
        });
    });
}

// Run all fixes
fixInputStyles();
setTimeout(() => {
    removeBlockingListeners();
    checkReactForms();
}, 500);

console.log('🎯 Try typing in the inputs now. Check browser console for debugging info.');

// Test function to manually set input value
window.setInputValue = function(selector, value) {
    const input = document.querySelector(selector);
    if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('Set value:', value, 'for input:', selector);
    }
};

console.log('💡 Use setInputValue("input[type=email]", "test@example.com") to manually set values');