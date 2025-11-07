import { setupTest, teardownTest, loginUser, goToCommunities, createCommunity, verifyCommunityDetailsDisplayed } from "../support/helpers";

describe("NewCommunityButton", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("14.1 | Create a new community", () => {
    loginUser("user123");
    goToCommunities();

    const communityName = "Button Create Community";
    const communityDesc = "Created via NewCommunityButton";
    createCommunity(communityName, communityDesc, false);
    verifyCommunityDetailsDisplayed(communityName, communityDesc, ["user123"]);
  });
});
