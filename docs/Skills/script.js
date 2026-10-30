/**
 * Vibe Skills Documentation - Interactive Features
 * Handles tabs, scroll behavior, and other dynamic interactions
 */

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', function() {
    initMainTabs();
    initTabs();
    initScrollSpy();
    initScrollToTop();
    initSmoothScroll();
    initCodeHighlights();
    initProgressBar();
    initScrollAnimations();
});

// ===== Main Tabs (Overview vs Architecture) =====
function initMainTabs() {
    const mainTabButtons = document.querySelectorAll('.main-tab-btn');
    const mainTabContents = document.querySelectorAll('.main-tab-content');

    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-main-tab');
            const targetContent = document.getElementById(tabId);

            mainTabButtons.forEach(btn => btn.classList.remove('active'));
            mainTabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            targetContent.classList.add('active');

            // Scroll to top of content
            targetContent.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Update URL hash
            history.pushState(null, null, `#${tabId}`);
        });
    });

    // Handle hash in URL on page load
    const hash = window.location.hash.slice(1);
    if (hash) {
        const matchingTab = document.querySelector(`[data-main-tab="${hash}"]`);
        if (matchingTab) {
            matchingTab.click();
        }
    }
}

// ===== Section Tabs (within sections) =====
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            targetContent.classList.add('active');

            history.pushState(null, null, `#${tabId}`);
        });
    });

    const hash = window.location.hash.slice(1);
    if (hash) {
        const matchingTab = document.querySelector(`[data-tab="${hash}"]`);
        if (matchingTab) {
            matchingTab.click();
        }
    }
}

// ===== Scroll Spy for Section Navigation =====
function initScrollSpy() {
    const navLinks = document.querySelectorAll('.section-nav-link');

    window.addEventListener('scroll', () => {
        const activeTabContent = document.querySelector('.main-tab-content.active');
        if (!activeTabContent) return;

        const sections = activeTabContent.querySelectorAll('section[id]');
        const scrollPosition = activeTabContent.scrollTop || window.scrollY;

        sections.forEach(section => {
            const sectionTop = section.offsetTop - activeTabContent.offsetTop;
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

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    });

    scrollTopBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('.main-tab-content.active');
        if (activeTab) {
            activeTab.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
                if (this.classList.contains('tab-btn') || this.classList.contains('main-tab-btn')) {
                    return;
                }

                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                history.pushState(null, null, `#${targetId}`);
            }
        });
    });
}

// ===== Code Syntax Highlighting =====
function initCodeHighlights() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        const lines = block.innerHTML.split('\n');
        if (lines.length > 1) {
            let lineNumbers = '<span class="line-numbers">';
            for (let i = 1; i <= lines.length; i++) {
                lineNumbers += `<span>${i}</span>`;
            }
            lineNumbers += '</span>';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'code-with-lines';
            wrapper.innerHTML = lineNumbers + '<div class="code-content">' + block.innerHTML + '</div>';
            block.parentNode.replaceChild(wrapper, block);
        }
        
        const language = block.className.split('language-')[1];
        if (language) {
            highlightLanguage(block, language);
        }
    });
}

function highlightLanguage(block, language) {
    const keywords = {
        markdown: ['---\n', 'name:', 'description:', 'user-invocable:', '---'],
        yaml: ['---\n', 'name:', 'description:', 'user-invocable:', 'license:', '---'],
        toml: ['skill_paths', 'enabled_skills', 'disabled_skills', 'experimental_enable_registry_skills'],
        python: ['def', 'class', 'import', 'from', 'if', 'else', 'for', 'while', 'return', 'self', 'SkillManager', 'SkillInfo'],
        text: ['vibe/core/skills/', 'models.py', 'manager.py', 'parser.py', 'builtins/', 'registry/']
    };

    const langKeywords = keywords[language] || [];
    
    const escapedKeywords = langKeywords.map(kw => {
        return kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    
    if (escapedKeywords.length > 0) {
        const pattern = new RegExp(`(${escapedKeywords.join('|')})`, 'g');
        
        block.innerHTML = block.innerHTML.replace(pattern, match => {
            if (match.includes(':') && !match.includes('--')) {
                return `<span class="token-property">${match}</span>`;
            } else if (match.includes('---')) {
                return `<span class="token-comment">${match}</span>`;
            } else if (['def', 'class', 'import', 'from', 'if', 'else', 'for', 'while', 'return'].includes(match)) {
                return `<span class="token-keyword">${match}</span>`;
            } else if (['SkillManager', 'SkillInfo', 'SkillMetadata'].includes(match)) {
                return `<span class="token-class">${match}</span>`;
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
            .token-class {
                color: #8b5cf6;
                font-weight: 600;
            }
            pre {
                border-radius: 0 0 8px 8px;
            }
        </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
}

addHighlightingStyles();

// ===== Progress Bar ===== */
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

// ===== Scroll Animations =====
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.step, .card, .example-card, .component-card, .security-card');
    
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
        el.classList.add('animate-ready');
        observer.observe(el);
    });
}

// Add animation styles
const animationStyles = `
    <style>
        .step, .card, .example-card, .component-card, .security-card {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .step.animate-in,
        .card.animate-in,
        .example-card.animate-in,
        .component-card.animate-in,
        .security-card.animate-in {
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
        .card:nth-child(4) { transition-delay: 0.4s; }
    </style>
`;
document.head.insertAdjacentHTML('beforeend', animationStyles);

// ===== Console Easter Egg =====
console.log('%c🎉 Welcome to Vibe Skills Documentation!', 'font-size: 20px; color: #6366f1; font-weight: bold;');
console.log('%cLearn how to supercharge your Vibe experience with custom Skills', 'color: #8b5cf6; font-size: 14px;');
