import { Q1_DESC, A1_TXT, A2_TXT } from '../../../server/testData/post_strings';
import { createAnswer, goToAnswerQuestion, loginUser, setupTest, teardownTest } from '../support/helpers';

describe("Cypress Tests to verify adding new answers", () => {

  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("1.1 | Created new answer should be displayed at the top of the answers page", () => {
    const answers = [
      "Test Answer 1",
      A1_TXT,
    ];
    
    loginUser('user123');

    goToAnswerQuestion(Q1_DESC);

    createAnswer(answers[0]);

    cy.get(".answerText").contains(answers[0])
    cy.contains("user123");
    cy.contains("0 seconds ago");
  });


  it("1.2 | Answer is mandatory when creating a new answer", () => {
    loginUser('user123');

    goToAnswerQuestion(Q1_DESC);

    cy.contains("Post Answer").click();
    cy.contains("Answer text cannot be empty");
  });
});
