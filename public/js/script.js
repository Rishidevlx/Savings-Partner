// public/js/script.js

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SLIDER LOGIC (Background Animation) ---
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;
    const slideInterval = 5000; 

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (dots[i]) dots[i].classList.remove('active');
        });
        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }
    
    // Initialize Slider
    if(slides.length > 0) {
        showSlide(currentSlide);
        setInterval(nextSlide, slideInterval);
    }

    // --- 2. FORM TOGGLE LOGIC (Sign In <-> Sign Up) ---
    const showSigninBtn = document.getElementById('show-signin');
    const showSignupBtn = document.getElementById('show-signup');
    const signupSection = document.getElementById('signup-section');
    const signinSection = document.getElementById('signin-section');

    if (showSigninBtn && showSignupBtn) {
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
    }

    // --- 3. PASSWORD VISIBILITY TOGGLE ---
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

    // --- 4. API CONFIGURATION ---
    // Leave empty for relative path (Works on both Vercel & Localhost automatically)
    const API_URL = ''; 

    const showToast = (message, type = 'success') => {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: type === 'success' 
                    ? "linear-gradient(to right, #00A79D, #00b09b)" 
                    : "linear-gradient(to right, #e74c3c, #ff5f6d)",
            },
        }).showToast();
    };

    // --- 5. VALIDATION LOGIC ---

    // Strict Email Regex (Checks for text@domain.extension)
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    
    // Strict Password Regex (Min 8 chars, 1 Letter, 1 Number)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;


    // --- SIGN UP VALIDATION ---
    const signupValidator = new JustValidate('#signup-form', {
        validateBeforeSubmitting: true,
    });

    signupValidator
        .addField('#fullname', [
            { rule: 'required', errorMessage: 'Full Name is required' },
            { rule: 'minLength', value: 3, errorMessage: 'Name must be at least 3 characters' }
        ])
        .addField('#phone', [
            { rule: 'required', errorMessage: 'Phone Number is required' },
            { rule: 'number', errorMessage: 'Phone must contain numbers only' },
            { rule: 'minLength', value: 10, errorMessage: 'Invalid Phone Number' },
            { rule: 'maxLength', value: 10, errorMessage: 'Invalid Phone Number' }
        ])
        .addField('#signup-email', [
            { rule: 'required', errorMessage: 'Email is required' },
            { rule: 'customRegexp', value: emailRegex, errorMessage: 'Enter a valid email (e.g., user@mail.com)' }
        ])
        .addField('#signup-password', [
            { rule: 'required', errorMessage: 'Password is required' },
            { rule: 'customRegexp', value: passwordRegex, errorMessage: 'Min 8 chars, at least 1 letter & 1 number' }
        ])
        .addField('#confirm-password', [
            { rule: 'required', errorMessage: 'Confirm Password is required' },
            { 
                validator: (value, fields) => value === fields['#signup-password'].elem.value,
                errorMessage: "Passwords do not match",
            }
        ])
        .onSuccess(async (event) => {
            event.preventDefault();
            const form = document.getElementById('signup-form');
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;

            // Loading State
            submitBtn.innerText = "Creating Account...";
            submitBtn.disabled = true;

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
                    showToast(result.message || 'Signup failed', 'error');
                }
            } catch (error) {
                console.error('Signup fetch error:', error);
                showToast('Server error. Please try again later.', 'error');
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });

    // --- SIGN IN VALIDATION (STRICT) ---
    const signinValidator = new JustValidate('#signin-form', {
        validateBeforeSubmitting: true,
    });

    signinValidator
        .addField('#signin-email', [
            { rule: 'required', errorMessage: 'Email is required' },
            { rule: 'customRegexp', value: emailRegex, errorMessage: 'Please enter a valid email address' }
        ])
        .addField('#signin-password', [
            { rule: 'required', errorMessage: 'Password is required' },
            { rule: 'minLength', value: 8, errorMessage: 'Password must be at least 8 characters long' }
        ])
        .onSuccess(async (event) => {
            event.preventDefault();
            const form = document.getElementById('signin-form');
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;

            // Loading State (Professional Touch)
            submitBtn.innerText = "Signing In...";
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.7";

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
                    // Store user data
                    localStorage.setItem('user', JSON.stringify(result.user));

                    // Success Toast
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
                    showToast(result.message || 'Invalid Credentials', 'error');
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = "1";
                }
            } catch (error) {
                console.error('Signin fetch error:', error);
                showToast('Unable to connect to server.', 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
            }
        });
});