// public/js/script.js

document.addEventListener('DOMContentLoaded', () => {

    // Slider and Form Toggle Logic
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;
    const slideInterval = 5000; 

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            dots[i].classList.remove('active');
        });
        slides[index].classList.add('active');
        dots[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }
    
    showSlide(currentSlide);
    setInterval(nextSlide, slideInterval);

    const showSigninBtn = document.getElementById('show-signin');
    const showSignupBtn = document.getElementById('show-signup');
    const signupSection = document.getElementById('signup-section');
    const signinSection = document.getElementById('signin-section');

    showSigninBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupSection.classList.remove('active');
        signinSection.classList.add('active');
    });

    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signinSection.classList.remove('active');
        signupSection.classList.add('active');
    });

    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', function (e) {
            const parent = e.target.closest('.password-group');
            const input = parent.querySelector('input');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            e.target.classList.toggle('fa-eye');
            e.target.classList.toggle('fa-eye-slash');
        });
    });

    // --- API & Validation ---
    const API_URL = '';

    const showToast = (message, type = 'success') => {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)",
            },
        }).showToast();
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Min 8 chars, at least one letter and one number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

    const signupValidator = new JustValidate('#signup-form');
    signupValidator
        .addField('#fullname', [{ rule: 'required' }, { rule: 'minLength', value: 3 }])
        .addField('#phone', [{ rule: 'required' }, { rule: 'number' }, { rule: 'minLength', value: 10 }, { rule: 'maxLength', value: 10 }])
        .addField('#signup-email', [
            { rule: 'required' }, 
            { rule: 'customRegexp', value: emailRegex, errorMessage: 'Invalid email address' }
        ])
        .addField('#signup-password', [
            { rule: 'required' }, 
            { rule: 'customRegexp', value: passwordRegex, errorMessage: 'Password must be 8+ chars with letters & numbers' }
        ])
        .addField('#confirm-password', [{ rule: 'required' }, {
            validator: (value, fields) => value === fields['#signup-password'].elem.value,
            errorMessage: "Passwords don't match",
        }])
        .onSuccess(async (event) => {
            event.preventDefault();
            const form = document.getElementById('signup-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch(`${API_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                
                const result = await response.json();

                if (response.ok) {
                    showToast('Sign up successful! Please log in.');
                    showSigninBtn.click();
                    form.reset();
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) {
                console.error('Signup fetch error:', error);
                showToast('An error occurred. Please try again.', 'error');
            }
        });

    const signinValidator = new JustValidate('#signin-form');
    signinValidator
        .addField('#signin-email', [
            { rule: 'required' }, 
            { rule: 'customRegexp', value: emailRegex, errorMessage: 'Invalid email format' }
        ])
        .addField('#signin-password', [{ rule: 'required' }])
        .onSuccess(async (event) => {
            event.preventDefault();
            const form = document.getElementById('signin-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

             try {
                const response = await fetch(`${API_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                
                const result = await response.json();

                if (response.ok && result.user) {
                    localStorage.setItem('user', JSON.stringify(result.user));

                    Toastify({
                        text: "Login successful! Redirecting...",
                        duration: 2000,
                        gravity: "top",
                        position: "right",
                        style: { background: "linear-gradient(to right, #00A79D, #00b09b)" },
                        callback: () => {
                            // Role Based Redirect
                            if (result.user.role === 'admin') {
                                window.location.href = '/admin.html';
                            } else {
                                window.location.href = '/dashboard.html';
                            }
                        }
                    }).showToast();
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) {
                console.error('Signin fetch error:', error);
                showToast('Login failed. Check server.', 'error');
            }
        });
});