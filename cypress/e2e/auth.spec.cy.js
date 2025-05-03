describe('template spec', () => {
  it('passes', () => {
    cy.visit('https://example.cypress.io')
  })
})

describe('Simple Node Server', () => {
  it('should display "Hello, World!" on the homepage', () => {
    // Visit the server's homepage
    cy.visit('http://localhost:3000');

    // Check if the page contains the text "Hello, World!"
    cy.contains('Hello, World!');
  });
});

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  describe('Registration', () => {
    it('should display registration form when clicking register link', () => {
      cy.contains('Register here').click();
      cy.get('h2').should('contain', 'Register');
      cy.get('input[type="email"]').should('exist');
      cy.get('input[type="password"]').should('exist');
      cy.get('button[type="submit"]').should('exist');
    });

    it('should show error when registering with existing email', () => {
      // First register a user
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Try to register again with same email
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      cy.contains('User already exists').should('be.visible');
    });

    it('should successfully register a new user', () => {
      const randomEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(randomEmail);
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      cy.contains('Registration successful').should('be.visible');
    });

    it('should redirect to login after successful registration', () => {
      const randomEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(randomEmail);
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Wait for redirect
      cy.get('h2', { timeout: 3000 }).should('contain', 'Login');
    });
  });

  describe('Registration with Phone Number', () => {
    it('should register with valid email, phone number, and password', () => {
      const randomEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      const randomPhone = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(randomEmail);
      cy.get('input[type="tel"]').type(randomPhone);
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Should be logged in and see user info
      cy.contains('Welcome').should('be.visible');
      cy.contains(randomEmail).should('be.visible');
      cy.contains(randomPhone).should('be.visible');
    });

    it('should show error when registering with existing phone number', () => {
      const randomEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      const phoneNumber = '+11234567890';

      // First registration
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(randomEmail);
      cy.get('input[type="tel"]').type(phoneNumber);
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Logout
      cy.contains('Logout').click();

      // Try registering with same phone number
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(`another${randomEmail}`);
      cy.get('input[type="tel"]').type(phoneNumber);
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      cy.contains('Phone number already exists').should('be.visible');
    });
  });

  describe('Login', () => {
    it('should display login form by default', () => {
      cy.get('h2').should('contain', 'Login');
      cy.get('input[type="email"]').should('exist');
      cy.get('input[type="password"]').should('exist');
      cy.get('button[type="submit"]').should('exist');
    });

    it('should show error with invalid credentials', () => {
      cy.get('input[type="email"]').type('wrong@example.com');
      cy.get('input[type="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();

      cy.contains('Invalid credentials').should('be.visible');
    });

    it('should successfully login with valid credentials', () => {
      // First register a new user
      const testEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      const testPassword = 'password123';

      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(testEmail);
      cy.get('input[type="password"]').type(testPassword);
      cy.get('button[type="submit"]').click();

      // Wait for redirect and login
      cy.get('h2', { timeout: 3000 }).should('contain', 'Login');
      cy.get('input[type="email"]').type(testEmail);
      cy.get('input[type="password"]').type(testPassword);
      cy.get('button[type="submit"]').click();

      cy.contains('Welcome').should('be.visible');
      cy.contains('Fetch Hello World').should('be.visible');
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route after login', () => {
      // Login first
      const testEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      const testPassword = 'password123';

      // Register
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(testEmail);
      cy.get('input[type="password"]').type(testPassword);
      cy.get('button[type="submit"]').click();

      // Login
      cy.get('input[type="email"]', { timeout: 3000 }).type(testEmail);
      cy.get('input[type="password"]').type(testPassword);
      cy.get('button[type="submit"]').click();

      // Try accessing protected route
      cy.contains('Fetch Hello World').click();
      cy.on('window:alert', (text) => {
        expect(text).to.equal('Hello, World!');
      });
    });
  });

  describe('Logout', () => {
    it('should logout successfully', () => {
      // Login first
      const testEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      const testPassword = 'password123';

      // Register
      cy.contains('Register here').click();
      cy.get('input[type="email"]').type(testEmail);
      cy.get('input[type="password"]').type(testPassword);
      cy.get('button[type="submit"]').click();

      // Login
      cy.get('input[type="email"]', { timeout: 3000 }).type(testEmail);
      cy.get('input[type="password"]').type(testPassword);
      cy.get('button[type="submit"]').click();

      // Logout
      cy.contains('Logout').click();

      // Verify return to login form
      cy.get('h2').should('contain', 'Login');
    });
  });

  describe('Registration and Auto-login', () => {
    beforeEach(() => {
      cy.visit('http://localhost:3000');
    });

    it('should automatically log in user after successful registration', () => {
      const randomEmail = `test${Math.random().toString(36).substring(7)}@example.com`;
      
      // Click register link
      cy.contains('Register here').click();
      
      // Fill and submit registration form
      cy.get('input[type="email"]').type(randomEmail);
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Should be immediately logged in and see the welcome message
      cy.contains('Welcome').should('be.visible');
      cy.contains('Fetch Hello World').should('be.visible');
      cy.contains('Logout').should('be.visible');
    });

    // ... other tests ...
  });
});