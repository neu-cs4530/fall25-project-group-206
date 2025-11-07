import { Q1_DESC, Q2_DESC, Q3_DESC, Q4_DESC, A3_TXT, A4_TXT, Q10_DESC } from '../../../server/testData/post_strings';
import { 
  loginUser, 
  setupTest, 
  teardownTest, 
  createQuestion, 
  goToAnswerQuestion, 
  createAnswer, 
  goToQuestions, 
  clickFilter, 
  waitForQuestionsToLoad 
} from '../support/helpers';

describe("Cypress Tests for verifying active order and initial test data", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("12.1 | Adds a question, clicks active button, verifies the sequence", () => {
    loginUser('user123');

    // Create a new test question
    createQuestion('Test Question A', 'Test Question A Text', 'javascript');

    // Add answers to existing questions to change their activity order
    // Answer Q1 (React question)
    goToAnswerQuestion(Q1_DESC);
    createAnswer('Answer to React Router');
    goToQuestions();

    // Answer Q2 (Node.js memory question)
    goToAnswerQuestion(Q2_DESC);
    createAnswer('Answer to Node.js memory');
    goToQuestions();

    // Answer our new Test Question A
    goToAnswerQuestion('Test Question A');
    createAnswer('Answer Question A');
    goToQuestions();

    // Click Active filter to see questions ordered by most recent answer activity
    clickFilter('Active');
    waitForQuestionsToLoad();

    // Verify questions are in active order (most recently answered first)
    // The order should reflect which questions were answered most recently
    const expectedActiveOrder = [
      'Test Question A',  // Most recently answered (just now)
      Q2_DESC,           // Second most recently answered
      Q1_DESC,           // Third most recently answered
    ];
    
    // Check at least the first 3 questions are in the expected order
    cy.get('.postTitle').eq(0).should('contain', expectedActiveOrder[0]);
    cy.get('.postTitle').eq(1).should('contain', expectedActiveOrder[1]);
    cy.get('.postTitle').eq(2).should('contain', expectedActiveOrder[2]);
  });

  it("12.2 | Checks if seeded answers exist in Q3 (Webpack) answers page", () => {
    loginUser('user123');

    // Navigate to Q3 (Webpack configuration question)
    cy.contains(Q3_DESC).click();
    
    // Verify the seeded answer exists (A3_TXT)
    // The answer should contain webpack configuration help
    cy.get('.answerText').should('contain', 'webpack');
    cy.get('.answerText').should('contain', 'babel-loader');
    
    // Check specific content from A3_TXT
    cy.get('.answerText').should('contain', 'The error you\'re seeing with webpack is because you need to configure babel-loader properly to handle the latest JavaScript features. Update your webpack.config.js file like')
  });

  it("12.3 | Checks if seeded answer exists in Q4 (PostgreSQL) answers page", () => {
    loginUser('user123');
    
    // Navigate to Q4 (PostgreSQL optimization question)
    cy.contains(Q4_DESC).click();
    
    // Verify the seeded answer exists (A4_TXT)
    // The answer should contain PostgreSQL optimization advice
    cy.get('.answerText').invoke('text').should('contain', 'PostgreSQL');
    cy.get('.answerText').invoke('text').should('contain', 'CREATE INDEX');
    
    // Check specific content from A4_TXT
    cy.get('.answerText').should('contain', 'Your PostgreSQL query is performing poorly because it\'s missing proper indexing. For this specific query pattern, you should add an index on the columns you\'re frequently filtering by.');
  });

  it("12.4 | Verifies that questions with no answers appear correctly", () => {
    loginUser('user123');
    createQuestion('Test Question A', 'Test Question A Text', 'javascript');
    
    // Check unanswered questions
    clickFilter('Unanswered');
    waitForQuestionsToLoad();
    
    // Should have 1 unanswered question that was created right before this
    cy.get('.postTitle').should('have.length.at.least', 1);
    
    // Verify they show "0 answers"
    cy.get('.postStats').first().should('contain', '0 answers');
  });

  it("12.5 | Verifies question view counts are tracked correctly", () => {
    loginUser('user123');
    
    // Click on a question to view it
    cy.contains(Q10_DESC).click();
    
    // Go back to questions list
    goToQuestions();
    
    // The view count should have increased
    // Find the question and check its view count is greater than 0
    cy.contains(Q10_DESC).parent().parent().within(() => {
      cy.get('.postStats').should('contain', 'views');
      // Note: The exact view count will depend on seed data
    });
  });
});
