describe('Login', () => {
  it('should login and access the Hello World page', () => {
    cy.visit('http://localhost:3000');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password');
    cy.get('button[type="submit"]').click();
    cy.contains('Fetch Hello World').click();
    cy.on('window:alert', (text) => {
      expect(text).to.contains('Hello, World!');
    });
  });
}); 