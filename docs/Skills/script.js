/**
 * Vibe Skills Documentation - Interactive Features
 * Handles tabs, scroll behavior, and other dynamic interactions
 */

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all interactive features
    initTabs();
    initScrollSpy();
    initScrollToTop();
    initSmoothScroll();
    initCodeHighlights();
});

// ===== Tabs =====
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Get the target tab ID from data attribute
            const tabId = button.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and target content
            button.classList.add('active');
            targetContent.classList.add('active');

            // Update URL hash for direct linking
            history.pushState(null, null, `#${tabId}`);
        });
    });

    // Handle hash in URL on page load
    const hash = window.location.hash.slice(1);
    if (hash) {
        const matchingTab = document.querySelector(`[data-tab="${hash}"]`);
        if (matchingTab) {
            matchingTab.click();
        }
    }
}

// ===== Scroll Spy (for navigation) =====
function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    // Intersection Observer for scroll spy
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -80% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.getAttribute('id');
                
                // Update active nav link
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    // Observe all sections
    sections.forEach(section => {
        observer.observe(section);
    });

    // Also update on scroll for sections that might not trigger intersection
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });
}

// ===== Scroll to Top Button =====
function initScrollToTop() {
    const scrollTopBtn = document.createElement('button');
    scrollTopBtn.className = 'scroll-top';
    scrollTopBtn.innerHTML = '&#9650;';
    scrollTopBtn.title = 'Scroll to top';
    document.body.appendChild(scrollTopBtn);

    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    });

    // Scroll to top on click
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ===== Smooth Scroll for Anchor Links =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').slice(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                // Check if it's a tab link
                if (this.classList.contains('tab-btn')) {
                    // Let the tab handler take care of it
                    return;
                }

                // Offset for fixed header
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                // Update URL without reload
                history.pushState(null, null, `#${targetId}`);
            }
        });
    });
}

// ===== Code Syntax Highlighting =====
function initCodeHighlights() {
    // Simple syntax highlighting for code blocks
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        // Add line numbers
        const lines = block.innerHTML.split('\n');
        if (lines.length > 1) {
            let lineNumbers = '<span class="line-numbers">';
            for (let i = 1; i <= lines.length; i++) {
                lineNumbers += `<span>${i}</span>`;
            }
            lineNumbers += '</span>';
            
            // Wrap code with line numbers
            const wrapper = document.createElement('div');
            wrapper.className = 'code-with-lines';
            wrapper.innerHTML = lineNumbers + '<div class="code-content">' + block.innerHTML + '</div>';
            block.parentNode.replaceChild(wrapper, block);
        }
        
        // Apply syntax highlighting based on language
        const language = block.className.split('language-')[1];
        if (language) {
            highlightLanguage(block, language);
        }
    });
}

function highlightLanguage(block, language) {
    // Simple keyword highlighting (expand this for better highlighting)
    const keywords = {
        markdown: ['---\n', 'name:', 'description:', 'user-invocable:', '---'],
        yaml: ['---\n', 'name:', 'description:', 'user-invocable:', 'license:', '---'],
        python: ['def', 'class', 'import', 'from', 'if', 'else', 'for', 'while', 'return'],
        bash: ['mkdir', 'touch', 'cd', 'ls', 'cat', 'echo', 'export', 'source']
    };

    const langKeywords = keywords[language] || [];
    
    // Escape regex special characters
    const escapedKeywords = langKeywords.map(kw => {
        return kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    
    // Create regex pattern
    if (escapedKeywords.length > 0) {
        const pattern = new RegExp(`(${escapedKeywords.join('|')})`, 'g');
        
        // Apply highlighting
        block.innerHTML = block.innerHTML.replace(pattern, match => {
            // Different colors for different types
            if (match.includes(':') && !match.includes('--')) {
                return `<span class="token-property">${match}</span>`;
            } else if (match.includes('---')) {
                return `<span class="token-comment">${match}</span>`;
            } else if (['def', 'class', 'import', 'from', 'if', 'else', 'for', 'while', 'return'].includes(match)) {
                return `<span class="token-keyword">${match}</span>`;
            } else {
                return `<span class="token-string">${match}</span>`;
            }
        });
    }
}

// ===== Add Syntax Highlighting Styles =====
function addHighlightingStyles() {
    const styles = `
        <style>
            .code-with-lines {
                position: relative;
                counter-reset: line;
            }
            .line-numbers {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 40px;
                padding: 1.25rem 0.5rem;
                background: rgba(0, 0, 0, 0.1);
                text-align: right;
                font-size: 0.85rem;
                color: #9ca3af;
                border-right: 1px solid var(--border);
                user-select: none;
                overflow: hidden;
            }
            .line-numbers span {
                display: block;
                line-height: 1.6;
            }
            .code-content {
                padding-left: 50px;
            }
            .token-keyword {
                color: #f59e0b;
            }
            .token-string {
                color: #10b981;
            }
            .token-property {
                color: #6366f1;
            }
            .token-comment {
                color: #9ca3af;
                font-style: italic;
            }
        </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
}

// Call this early
addHighlightingStyles();

// ===== Keyboard Navigation =====
document.addEventListener('keydown', (e) => {
    // ESC to close any open modals/dialogs (future feature)
    if (e.key === 'Escape') {
        // Close logic here
    }
});

// ===== Copy Code to Clipboard =====
function initCopyCode() {
    // Add copy buttons to code blocks
    const codeBlocks = document.querySelectorAll('pre');
    
    codeBlocks.forEach(block => {
        if (block.textContent.trim().length > 20) { // Only add for longer blocks
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = 'Copy';
            copyBtn.title = 'Copy to clipboard';
            
            // Add button to code header or create one
            const header = block.querySelector('.code-header');
            if (header) {
                header.appendChild(copyBtn);
            }
            
            copyBtn.addEventListener('click', () => {
                const code = block.textContent;
                
                navigator.clipboard.writeText(code).then(() => {
                    copyBtn.innerHTML = 'Copied!';
                    copyBtn.style.background = 'var(--success)';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = 'Copy';
                        copyBtn.style.background = '';
                    }, 2000);
                }).catch(err => {
                    copyBtn.innerHTML = 'Error';
                    copyBtn.style.background = 'var(--danger)';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = 'Copy';
                        copyBtn.style.background = '';
                    }, 2000);
                });
            });
        }
    });
}

// Call copy code initialization
document.addEventListener('DOMContentLoaded', initCopyCode);

// ===== Add Copy Button Styles =====
const copyBtnStyles = `
    <style>
        .copy-btn {
            background: var(--bg);
            border: 1px solid var(--border);
            color: var(--text-light);
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: var(--transition);
            margin-left: auto;
        }
        .copy-btn:hover {
            background: var(--primary-bg);
            color: var(--primary);
            border-color: var(--primary);
        }
        .code-header {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
    </style>
`;
document.head.insertAdjacentHTML('beforeend', copyBtnStyles);

// ===== Progress Bar on Scroll =====
function initProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        progressBar.style.width = `${progress}%`;
    });
}

// Add progress bar styles
const progressStyles = `
    <style>
        .progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            z-index: 1000;
            transition: width 0.3s ease;
        }
    </style>
`;
document.head.insertAdjacentHTML('beforeend', progressStyles);

// Initialize progress bar
document.addEventListener('DOMContentLoaded', initProgressBar);

// ===== Intersection Observer for Animations =====
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.step, .card, .example-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, {
        threshold: 0.1
    });

    animatedElements.forEach(el => {
        observer.observe(el);
    });
}

// Add animation styles
const animationStyles = `
    <style>
        .step, .card, .example-card {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .step.animate-in, .card.animate-in, .example-card.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .step:nth-child(1) { transition-delay: 0.1s; }
        .step:nth-child(2) { transition-delay: 0.2s; }
        .step:nth-child(3) { transition-delay: 0.3s; }
        .step:nth-child(4) { transition-delay: 0.4s; }
        .step:nth-child(5) { transition-delay: 0.5s; }
        
        .card:nth-child(1) { transition-delay: 0.1s; }
        .card:nth-child(2) { transition-delay: 0.2s; }
        .card:nth-child(3) { transition-delay: 0.3s; }
    </style>
`;
document.head.insertAdjacentHTML('beforeend', animationStyles);

// Initialize scroll animations
document.addEventListener('DOMContentLoaded', initScrollAnimations);

// ===== Console Easter Egg =====
console.log('%c🎉 Welcome to Vibe Skills Documentation!', 'font-size: 20px; color: #6366f1; font-weight: bold;');
console.log('%cLearn how to supercharge your Vibe experience with custom Skills', 'color: #8b5cf6; font-size: 14px;');
