import { goToCommunities, createCommunity, loginUser, setupTest, teardownTest } from '../support/helpers';

const C1_NAME = "React Enthusiasts";
const C2_NAME = "Backend Masters";
const C3_NAME = "Data Science Hub";
const C4_NAME = "DevOps Specialists";
const C5_NAME = "TypeScript Champions";

describe("Cypress Tests to verify display of all communities", () => {

  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  it("4.1 | Displays all communities on the community page", () => {
    
    // login with seed data user
    loginUser('user123');

    // go to all communities page
    goToCommunities();

    const C_NAME_NEW = "Public Community1";
    createCommunity(C_NAME_NEW, "A public community for devs", false);
    const cTitles = [
      C1_NAME,
      C2_NAME,
      C3_NAME,
      C4_NAME,
      C5_NAME,
      C_NAME_NEW
    ];

    goToCommunities();

    // verify all communities are displayed
    cy.get('.community-card').each(($el, index, $list) => {
      cy.wrap($el).should("contain", cTitles[index]);});

  });

  it("4.2 | Should search for a community", () => {
    loginUser('user123');
    goToCommunities();
    cy.get('.community-search').type(C1_NAME);
    cy.get('.community-card').should("contain", C1_NAME);
  });

});
