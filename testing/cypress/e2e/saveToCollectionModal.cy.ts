import { goToQuestions, loginUser, setupTest, teardownTest, goToCollections, verifyQuestionSaved, verifyQuestionUnsaved, openSaveToCollectionModal, toggleSaveQuestionToCollection, waitForQuestionsToLoad } from '../support/helpers';

const COL5_TITLE = "Full-stack Developer Resources";
const COL10_TITLE = "React Favorites";

const Q2_TITLE = "Node.js memory issues when handling large file uploads";

describe("Cypress Tests to verify saving to collection", () => {

  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("16.1 | Allows users to save questions to their collections with a save button, and shows saved status", () => {
    
    // login with a seed data user
    loginUser('user123');

    // go to questions page
    goToQuestions();
    waitForQuestionsToLoad();

    // save question #2 to collection #10
    toggleSaveQuestionToCollection(Q2_TITLE, COL10_TITLE);

    // close the modal
    cy.get('.close-btn').click();

    // reload the page
    goToQuestions();
    waitForQuestionsToLoad();

    // open the modal again
    openSaveToCollectionModal(Q2_TITLE)

    // verify the collection #10 is marked as saved
    verifyQuestionSaved(COL10_TITLE);

  });

  it("16.2 | Allows users to unsave questions to their collections with a save button, and shows unsaved status", () => {
    
    loginUser('user123');

    // go to questions page
    goToQuestions();
    waitForQuestionsToLoad();

    // save question #2 to collection #5
    toggleSaveQuestionToCollection(Q2_TITLE, COL5_TITLE);

    // close the modal
    cy.get('.close-btn').click();

    // reload the page
    goToQuestions();
    waitForQuestionsToLoad();

    // open the modal again
    openSaveToCollectionModal(Q2_TITLE);

    // verify the collection #5 is marked as unsaved
    verifyQuestionUnsaved(COL5_TITLE);

  });

});
