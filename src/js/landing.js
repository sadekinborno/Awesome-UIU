document.addEventListener('DOMContentLoaded', () => {
    // Update visitor count
    updateVisitorCount();
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Prevent clicks on coming soon cards
    document.querySelectorAll('.tool-card-coming-soon, .resource-card-coming-soon').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });

    // Add parallax effect to hero shapes
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 20 - 10;
        mouseY = (e.clientY / window.innerHeight) * 20 - 10;
        
        document.querySelectorAll('.shape').forEach((shape, index) => {
            const speed = (index + 1) * 0.5;
            shape.style.transform = `translate(${mouseX * speed}px, ${mouseY * speed}px)`;
        });
    });

    // Add scroll reveal animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all cards
    document.querySelectorAll('.tool-card, .resource-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

// ============================================
// Visitor Counter - Image-based (No CORS, No blocking!)
// ============================================
function updateVisitorCount() {
    const element = document.getElementById('visitorCount');
    
    // Create a hidden image to trigger the counter
    // This bypasses all CORS and DNS restrictions
    const counterImg = new Image();
    const pageId = 'theawesomeuiu.netlify.app';
    
    // Use hits.sh SVG counter - it increments when the image loads
    counterImg.src = `https://hits.sh/${pageId}.svg?style=flat&label=visitors&extraCount=100&color=007acc`;
    
    console.log('Loading visitor counter via image...');
    
    counterImg.onload = function() {
        console.log('Counter image loaded successfully!');
        
        // Parse the SVG to extract the count
        fetch(`https://hits.sh/${pageId}.svg?style=flat&label=visitors&extraCount=100&color=007acc`)
            .then(response => response.text())
            .then(svgText => {
                // Extract number from SVG text (format: >123<)
                const match = svgText.match(/>(\d+)</);
                if (match && match[1]) {
                    const count = parseInt(match[1]);
                    console.log('Visitor count:', count);
                    animateCounter('visitorCount', 0, count, 2000);
                } else {
                    throw new Error('Could not parse count from SVG');
                }
            })
            .catch(error => {
                console.error('Failed to parse visitor count:', error);
                useFallbackCounter(element);
            });
    };
    
    counterImg.onerror = function() {
        console.error('Counter image failed to load');
        useFallbackCounter(element);
    };
}

function useFallbackCounter(element) {
    // Fallback: Use localStorage for local testing
    let localCount = parseInt(localStorage.getItem('awesome-uiu-visits') || '0');
    localCount++;
    localStorage.setItem('awesome-uiu-visits', localCount.toString());
    
    console.log('Using localStorage fallback:', localCount);
    
    if (element) {
        animateCounter('visitorCount', 0, localCount, 1000);
        element.title = 'Fallback mode - Global counter active on deployment';
    }
}

// Animate counter with easing
function animateCounter(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = formatNumber(end);
            clearInterval(timer);
        } else {
            element.textContent = formatNumber(Math.floor(current));
        }
    }, 16);
}

// Format number with commas
function formatNumber(num) {
    return num.toLocaleString('en-US');
}
