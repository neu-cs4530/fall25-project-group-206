import { setupTest, teardownTest, loginUser, goToCommunities, createCommunity, verifyCommunityDetailsDisplayed } from "../support/helpers";

describe("CommunityPage", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("8.1 | Display community page", () => {
    loginUser("user123");
    goToCommunities();

    const communityName = "Community Page Display";
    const communityDesc = "Description for display test";
    createCommunity(communityName, communityDesc, false);
    verifyCommunityDetailsDisplayed(communityName, communityDesc, ["user123"]);
  });
});
