/**
 * Real-World Biographical Metadata, Sexual Orientation & Fidelity Dispositions for all 76+ Characters.
 */

export const CHARACTER_BIOGRAPHIES = {
  // 1. Financial Titans
  buffett: { age: 93, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Oracle of Omaha. Prefers value investing and simple living.' },
  jobs: { age: 56, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'High Loyalty', bio: 'Design visionary and Apple co-founder. Obsessed with perfection.' },
  musk: { age: 52, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Divorced', fidelity: 'Ambitious / Flirtatious', bio: 'Engineering mogul and Tesla/SpaceX architect.' },
  rockefeller: { age: 86, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Widowed', fidelity: 'Strictly Faithful', bio: 'Standard Oil founder. Systematic monopoly titan.' },
  carnegie: { age: 83, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Steel magnate and philanthropist.' },
  ford: { age: 84, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'High Loyalty', bio: 'Automotive pioneer of assembly line mass production.' },
  keynes: { age: 62, gender: 'Male', orientation: 'Bisexual', maritalStatus: 'Married', fidelity: 'Open Alliance', bio: 'Macroeconomist pioneer. Historically open to male and female partners.' },

  // 2. Crime Syndicate Members
  capone: { age: 48, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Syndicate Loyal', bio: 'Chicago Outfit boss.' },
  luciano: { age: 64, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Single', fidelity: 'High Romance Risk', bio: 'National Crime Commission architect.' },
  blanco: { age: 43, gender: 'Female', orientation: 'Heterosexual', maritalStatus: 'Widowed', fidelity: 'High Romance Risk', bio: 'The Black Widow. Ruthless queenpin of nightlife rackets.' },

  // 3. US Presidents & Leaders
  washington: { age: 67, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Founding Commander and advocate for national stability.' },
  lincoln: { age: 56, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Union Preserver and infrastructure champion.' },
  jfk: { age: 46, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'High Flirtation Risk', bio: 'New Frontier charismatic leader.' },

  // 4. Government Agency Heads
  hoover: { age: 77, gender: 'Male', orientation: 'Homosexual', maritalStatus: 'Single', fidelity: 'Institution Loyal', bio: '1st FBI Director. Historically documented lifelong partnership with Clyde Tolson. Accepts male same-sex romance!' },
  powell: { age: 71, gender: 'Male', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Federal Reserve Chairman. Data-dependent monetary controller.' },
  khan: { age: 35, gender: 'Female', orientation: 'Heterosexual', maritalStatus: 'Married', fidelity: 'Dedicated Regulator', bio: 'Neo-Brandeisian FTC Chair pushing tech monopoly breakups.' },
}

export function getCharacterBiography(npcId) {
  return CHARACTER_BIOGRAPHIES[npcId] || {
    age: 45,
    gender: 'Male',
    orientation: 'Heterosexual',
    maritalStatus: 'Single',
    fidelity: 'Open to Alliance',
    bio: 'Prominent figure in the Capital Syndicate.',
  }
}
