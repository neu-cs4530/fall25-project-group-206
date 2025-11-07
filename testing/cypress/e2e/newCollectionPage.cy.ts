import {
  loginUser,
  setupTest,
  teardownTest,
  goToMyCollections,
  goToCreateCollection,
  verifyCollectionPageDetails,
  createNewCollection,
  verifyCollectionExists
} from '../support/helpers';

describe('Cypress Tests for creating collections', () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it('13.1 | Allows user to create a new Public collection', () => {
    const collectionName = 'Reactss Favorites';

    // Log in
    loginUser('user123');

    // Navigate to My Collections
    goToMyCollections();

    // Click "Create Collection"
    goToCreateCollection();

    createNewCollection('Reactss Favorites', 'A list of React resources', false);

    goToMyCollections();

    // Verify the resulting collection page
    verifyCollectionExists(collectionName);
    // cy.get('.collection-meta').should('contain', 'Public');
    verifyCollectionPageDetails(collectionName, "user123");
  });

  it('13.2 | Allows user to create a new Private collection', () => {
    const collectionName = 'Private Collection';

    // Log in
    loginUser('user123');

    // Navigate to My Collections
    goToMyCollections();

    // Click "Create Collection"
    goToCreateCollection();
    createNewCollection('Private Collection', 'Only I can see this', true);

    // Verify the resulting collection page
    verifyCollectionExists(collectionName);
    // cy.get('.collection-meta').should('contain', 'Private');

    verifyCollectionPageDetails(collectionName, "user123");
  });
});