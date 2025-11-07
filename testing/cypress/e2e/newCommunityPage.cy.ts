import { setupTest, teardownTest, loginUser, goToCommunities, verifyCommunityDetailsDisplayed } from "../support/helpers";

describe("NewCommunityPage", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("15.1 | Create a new community with the form", () => {
    loginUser("user123");
    goToCommunities();

    const communityName = "Page Create Community";
    const communityDesc = "Created via NewCommunityPage form";

    cy.get('.new-community-button').click();
    // Use expected classnames instead of placeholder selectors
    cy.get('.new-community-input').eq(0).type(communityName);
    cy.get('.new-community-input').eq(1).type(communityDesc);
    cy.get('.new-community-submit').click();

    // We should land on the community page for the new id
    cy.url().should('include', '/communities/');
    verifyCommunityDetailsDisplayed(communityName, communityDesc, ["user123"]);
  });
});
