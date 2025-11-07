import { setupTest, teardownTest, loginUser, goToCommunities, createCommunity, viewCommunityCard } from "../support/helpers";

describe("CommunityMembershipButton", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("7.1 | Join or leave communities upon clicking", () => {
    // Login with seed data user
    loginUser("user123");

    // Go to communities and create a new community
    goToCommunities();
    const communityName = "Test Community";
    const communityDesc = "Community created for join/leave flow";
    createCommunity(communityName, communityDesc, false);

    // Log out and switch to a different user
    cy.get(".logout-button").click();

    // Login as another user to join/leave
    loginUser("user234", "strongP@ss234");
    goToCommunities();

    // Open the created community card
    viewCommunityCard(communityName);

    // Join
    cy.contains("button", "Join").click();
    cy.contains("button", "Leave").should("exist");

    // Leave
    cy.contains("button", "Leave").click();
    cy.contains("button", "Join").should("exist");
  });
});
