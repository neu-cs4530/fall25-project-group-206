import { Q1_DESC, Q2_DESC, Q3_DESC, Q4_DESC } from '../../../server/testData/post_strings';
import { createQuestion, goToAskQuestion, loginUser, setupTest, teardownTest } from '../support/helpers';

describe("Cypress Tests to verify asking new questions", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });


  it("2.1 | Ask a Question creates and displays expected meta data", () => {
    loginUser('user123');

    createQuestion("Test Question Q1", "Test Question Q1 Text T1", "javascript");

    cy.contains("Fake Stack Overflow");
    cy.contains("11 questions");
    cy.contains("user123 asked 0 seconds ago");
    const answers = [
      "0 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers",
      "1 answers"
    ];
    const views = [
      "0 views",
      "3 views",
      "2 views",
      "6 views",
      "4 views",
      "5 views",
      "3 views",
      "8 views",
      "4 views",
      "7 views",
      "5 views",
    ];
    cy.get(".postStats").each(($el, index, $list) => {
      cy.wrap($el).should("contain", answers[index]);
      cy.wrap($el).should("contain", views[index]);
    });
    cy.contains("Unanswered").click();
    cy.get(".postTitle").should("have.length", 1);
    cy.contains("1 questions");
  });

  it("2.2 | Ask a Question with empty title shows error", () => {
    loginUser('user123');
    
    cy.contains("Ask a Question").click();
    cy.get("#formTextInput").type("Test Question 1 Text Q1");
    cy.get("#formTagInput").type("javascript");
    cy.contains("Post Question").click();
    
    cy.contains("Title cannot be empty");
  });
});