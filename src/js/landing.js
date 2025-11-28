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
// Visitor Counter
// ============================================
async function updateVisitorCount() {
    const element = document.getElementById('visitorCount');
    
    try {
        console.log('Fetching visitor count...');
        
        // Try CountAPI first
        const response = await fetch('https://api.countapi.xyz/hit/awesome-uiu/visits', {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Visitor count received:', data.value);
        
        // Animate the counter from 0 to actual value
        animateCounter('visitorCount', 0, data.value, 2000);
        
    } catch (error) {
        console.error('CountAPI failed, using fallback:', error);
        
        // Fallback: Use localStorage for local counting (demo purposes)
        let localCount = parseInt(localStorage.getItem('awesome-uiu-visits') || '0');
        localCount++;
        localStorage.setItem('awesome-uiu-visits', localCount.toString());
        
        console.log('Using local counter:', localCount);
        
        if (element) {
            // Show local count with indicator it's offline
            animateCounter('visitorCount', 0, localCount, 1000);
            
            // Add small indicator (optional)
            setTimeout(() => {
                element.title = 'Offline mode - showing local visits';
            }, 1000);
        }
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
