import { createAnswer, createQuestion, goToAnswerQuestion, goToQuestions, loginUser, setupTest, teardownTest } from "../support/helpers";

const Q1_TITLE = "How to properly handle async data fetching in React?";
const Q2_TITLE = "Node.js memory issues when handling large file uploads";
const Q3_TITLE = "Webpack configuration issues with latest JavaScript features";
const Q4_TITLE = "Optimizing a slow PostgreSQL query with JOINs";
const Q5_TITLE = "How to handle edge cases in JavaScript array processing";
const Q6_TITLE = "Fixing CORS issues with fetch API in React frontend";
const Q7_TITLE = "Improving performance of Python data processing script";
const Q8_TITLE = "Docker container environment variable configuration";
const Q9_TITLE = "Proper way to handle async/await in JavaScript";
const Q10_TITLE = "Preventing memory leaks in React applications";

describe("Cypress Tests to verify order of questions displayed", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it('10.1 | Adds three questions and one answer, then click "Questions", then click unanswered button, verifies the sequence', () => {
    loginUser('user123');

    createQuestion("Test Question A", "Test Question A Text", "javascript");

    createQuestion("Test Question B", "Test Question B Text", "javascript");

    createQuestion("Test Question C", "Test Question C Text", "javascript");

    goToAnswerQuestion("Test Question A");

    createAnswer("Answer Question A");

    goToQuestions();

    // clicks unanswered
    cy.contains("Unanswered").click();
    const qTitles = ["Test Question C", "Test Question B"];
    cy.get(".postTitle").each(($el, index, $list) => {
      cy.wrap($el).should("contain", qTitles[index]);
    });
  });

  it("10.2 | Check if questions are displayed in descending order of dates.", () => {
    const qTitles = [
      Q10_TITLE,
      Q9_TITLE,
      Q8_TITLE,
      Q7_TITLE,
      Q6_TITLE,
      Q5_TITLE,
      Q4_TITLE,
      Q3_TITLE,
      Q2_TITLE,
      Q1_TITLE
    ];

    loginUser('user123');
    
    cy.get(".postTitle").each(($el, index, $list) => {
      cy.wrap($el).should("contain", qTitles[index]);
    });
  });

  it("10.3 | successfully shows all questions in model in most viewed order", () => {
    const qTitles = [
      Q4_TITLE,
      Q2_TITLE,
      Q8_TITLE,
      Q6_TITLE,
      Q1_TITLE,
      Q7_TITLE,
      Q3_TITLE,
      Q10_TITLE,
      Q5_TITLE,
      Q9_TITLE
    ];

    loginUser('user123');

    cy.contains("Most Viewed").click();
    cy.get(".postTitle").each(($el, index, $list) => {
      cy.wrap($el).should("contain", qTitles[index]);
    });
  });
});