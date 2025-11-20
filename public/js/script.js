// public/js/script.js

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. AUTO LOGIN LOGIC (NEW FEATURE) ---
    // App open pannadhum user irukangala nu check pannum
    const checkUser = () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.id) {
            // User irundha, direct-a ulla anuppidu
            if (user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        }
    };
    checkUser(); // Run immediately

    // --- 2. SLIDER LOGIC ---
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;
    const slideInterval = 5000; 

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (dots[i]) dots[i].classList.remove('active');
        });
        if(slides[index]) slides[index].classList.add('active');
        if(dots[index]) dots[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }
    
    if(slides.length > 0) {
        showSlide(currentSlide);
        setInterval(nextSlide, slideInterval);
    }

    // --- 3. FORM TOGGLE LOGIC ---
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

    // --- 4. PASSWORD VISIBILITY ---
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

    // --- 5. API & VALIDATION ---
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

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

    // SIGN UP
    const signupValidator = new JustValidate('#signup-form', { validateBeforeSubmitting: true });
    signupValidator
        .addField('#fullname', [{ rule: 'required' }, { rule: 'minLength', value: 3 }])
        .addField('#phone', [{ rule: 'required' }, { rule: 'number' }, { rule: 'minLength', value: 10 }, { rule: 'maxLength', value: 10 }])
        .addField('#signup-email', [{ rule: 'required' }, { rule: 'customRegexp', value: emailRegex, errorMessage: 'Enter a valid email' }])
        .addField('#signup-password', [{ rule: 'required' }, { rule: 'customRegexp', value: passwordRegex, errorMessage: 'Min 8 chars, letter & number' }])
        .addField('#confirm-password', [{ rule: 'required' }, { validator: (value, fields) => value === fields['#signup-password'].elem.value, errorMessage: "Passwords do not match" }])
        .onSuccess(async (event) => {
            event.preventDefault();
            const form = document.getElementById('signup-form');
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "Creating...";
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
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
                showToast('Server error. Try again.', 'error');
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });

    // SIGN IN
    const signinValidator = new JustValidate('#signin-form', { validateBeforeSubmitting: true });
    signinValidator
        .addField('#signin-email', [{ rule: 'required' }, { rule: 'customRegexp', value: emailRegex, errorMessage: 'Enter a valid email' }])
        .addField('#signin-password', [{ rule: 'required' }])
        .onSuccess(async (event) => {
            event.preventDefault();
            const form = document.getElementById('signin-form');
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "Signing In...";
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
                });
                const result = await response.json();
                if (response.ok && result.user) {
                    localStorage.setItem('user', JSON.stringify(result.user));
                    Toastify({
                        text: "Success! Redirecting...",
                        duration: 1500,
                        gravity: "top",
                        position: "right",
                        style: { background: "#00A79D" },
                        callback: () => {
                            // Redirect based on Role
                            if (result.user.role === 'admin') window.location.href = '/admin.html';
                            else window.location.href = '/dashboard.html';
                        }
                    }).showToast();
                } else {
                    showToast(result.message || 'Invalid Credentials', 'error');
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                showToast('Connection failed.', 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
});