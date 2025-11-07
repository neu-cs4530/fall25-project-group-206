import { createCommunity, verifyCommunityDetailsDisplayed, verifyCommunityDetailsNotDisplayed, goToCommunities, viewCommunityCard, loginUser, setupTest, teardownTest } from '../support/helpers';

const C1_NAME = "React Enthusiasts";
const C1_DESC = "A community dedicated to all things React, from beginner questions to advanced patterns and performance optimizations. Share your projects, ask for help, and collaborate on solving React challenges.";
const C1_MEMBERS = ["reactexpert",
      "reactninja",
      "newbiereactdev",
      "reactlearner",
      "frontenddev",
      "user123",
      "user345",
      "typescriptfan",
      "jsdeveloper"];

const C5_NAME = "TypeScript Champions";
const C5_DESC = "Private community for TypeScript experts to discuss advanced type systems, compiler optimizations, and enterprise-level TypeScript architecture. By invitation only.";
const C5_MEMBERS = ["typescriptfan", "reactexpert", "edgecaseexpert", "user345", "webpackwizard"];

describe("Cypress Tests to verify display of community information", () => {

  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("6.1 | Displays community card for selected community", () => {
    
    loginUser('user123');

    // go to all communities page
    goToCommunities();

    // go to the new community
    viewCommunityCard(C1_NAME);

    // verify community information is displayed
    verifyCommunityDetailsDisplayed(C1_NAME, C1_DESC, C1_MEMBERS);

  });

  it("6.2 | Does not display private community information", () => {
    
    loginUser('user123');

    // go to all communities page
    goToCommunities();

    // go to the new community
    viewCommunityCard(C5_NAME);

    // verify community information is displayed
    verifyCommunityDetailsNotDisplayed(C5_NAME, C5_DESC, C5_MEMBERS);

  });

});
