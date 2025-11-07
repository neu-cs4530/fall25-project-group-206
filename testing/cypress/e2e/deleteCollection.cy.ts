import {deleteCollection, goToMyCollections, loginUser, setupTest, teardownTest, verifyCollectionExists } from '../support/helpers';

describe("Cypress Tests to verify deleting a collections", () => {

  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("9.1 | Delete an exisitng collections in the My Collections Page", () => {
    
    loginUser('user123');

    goToMyCollections();
    
    cy.get('.collections-title').should('contain', "Collections");

    // Verify some pre-seeded collections appear
    verifyCollectionExists("React Favorites");

    deleteCollection("React Favorites");

    // Verify deletion
    cy.get('.collection-name').should('not.contain', "React Favorites");

  });
});