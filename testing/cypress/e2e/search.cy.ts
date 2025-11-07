import { Q1_DESC, Q2_DESC, Q3_DESC, Q4_DESC, Q5_DESC, Q6_DESC, Q7_DESC, Q8_DESC, Q9_DESC, Q10_DESC } from '../../../server/testData/post_strings';
import { 
  loginUser, 
  setupTest, 
  teardownTest, 
  performSearch, 
  verifyQuestionOrder, 
  waitForQuestionsToLoad 
} from '../support/helpers';

describe("Cypress Tests to verify searching questions", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("17.1 | Search for a question using text content that does not exist", () => {
    const searchText = "Web3";
    
    loginUser('user123');
    
    // Perform search for non-existent content
    performSearch(searchText);
    
    // Verify no results found
    cy.get('.postTitle').should('have.length', 0);
    cy.contains('No Questions Found').should('be.visible');
  });

  it("17.2 | Search string in question text - finds memory-related questions", () => {
    loginUser('user123');
    
    // Search for text that appears in Q2's content (memory issues) and Q10 (memory leaks)
    performSearch('memory');
    waitForQuestionsToLoad();
    
    // Should find Q2 (Node.js memory issues) and Q10 (React memory leaks)
    cy.get('.postTitle').should('contain', Q2_DESC);
    cy.get('.postTitle').should('contain', Q10_DESC);
  });

  it("17.3 | Search string in question text - finds PostgreSQL question", () => {
    loginUser('user123');
    
    // Search for text that appears in Q4's content (PostgreSQL)
    performSearch('PostgreSQL');
    waitForQuestionsToLoad();
    
    // Should find Q4 about PostgreSQL query optimization
    const expectedResults = [Q4_DESC];
    verifyQuestionOrder(expectedResults);
  });

  it("17.4 | Search a question by tag - react tag", () => {
    loginUser('user123');
    
    // Search for react tag (tag3)
    // Based on seed data: Q1, Q6, Q10 have react tag
    performSearch('[react]');
    waitForQuestionsToLoad();
    
    cy.get('.postTitle').should('contain', Q1_DESC);
    cy.get('.postTitle').should('contain', Q6_DESC);
    cy.get('.postTitle').should('contain', Q10_DESC);
  });

  it("17.5 | Search a question by tag - javascript tag", () => {
    loginUser('user123');
    
    // Search for javascript tag (tag1)
    // Based on seed data: Q1, Q5, Q9 have javascript tag
    performSearch('[javascript]');
    waitForQuestionsToLoad();
    
    cy.get('.postTitle').should('contain', Q1_DESC);
    cy.get('.postTitle').should('contain', Q5_DESC);
    cy.get('.postTitle').should('contain', Q9_DESC);
  });

  it("17.6 | Search a question by tag - python tag", () => {
    loginUser('user123');
    
    // Search for python tag (tag2)
    // Based on seed data: Q2, Q7 have python tag
    performSearch('[python]');
    waitForQuestionsToLoad();
    
    cy.get('.postTitle').should('contain', Q2_DESC);
    cy.get('.postTitle').should('contain', Q7_DESC);
  });

  it("17.7 | Search a question by tag - node.js tag", () => {
    loginUser('user123');
    
    // Search for node.js tag (tag4)
    // Based on seed data: Q3, Q8 have node.js tag
    performSearch('[node.js]');
    waitForQuestionsToLoad();
    
    cy.get('.postTitle').should('contain', Q3_DESC);
    cy.get('.postTitle').should('contain', Q8_DESC);
  });

  it("17.8 | Search for a question using a tag that does not exist", () => {
    loginUser('user123');
    
    // Search for non-existent tag
    performSearch('[nonExistentTag]');
    
    // Verify no results found
    cy.get('.postTitle').should('have.length', 0);
    cy.contains('No Questions Found').should('be.visible');
  });

  it("17.9 | Search with multiple terms finds relevant questions", () => {
    loginUser('user123');
    
    // Search for multiple terms that should match React-related questions
    performSearch('React component');
    waitForQuestionsToLoad();
    
    // Should find questions containing either "React" or "component"
    cy.get('.postTitle').should('have.length.at.least', 1);
  });
});
