/**
 * Real-World Biographical Metadata & Fidelity Dispositions for all 76+ Characters.
 */

export const CHARACTER_BIOGRAPHIES = {
  // 1. Financial Titans
  buffett: { age: 93, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Oracle of Omaha. Prefers value investing and simple living in Omaha/Kyoto.' },
  jobs: { age: 56, gender: 'Male', maritalStatus: 'Married', fidelity: 'High Loyalty', bio: 'Design visionary and Apple co-founder. Obsessed with perfection.' },
  musk: { age: 52, gender: 'Male', maritalStatus: 'Divorced', fidelity: 'Ambitious / Flirtatious', bio: 'Engineering mogul and Tesla/SpaceX architect. Highly volatile.' },
  rockefeller: { age: 86, gender: 'Male', maritalStatus: 'Widowed', fidelity: 'Strictly Faithful', bio: 'Standard Oil founder. Systematic monopoly titan.' },
  carnegie: { age: 83, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Steel magnate and philanthropist. Master of heavy industry.' },
  ford: { age: 84, gender: 'Male', maritalStatus: 'Married', fidelity: 'High Loyalty', bio: 'Automotive pioneer of assembly line mass production.' },
  gates: { age: 68, gender: 'Male', maritalStatus: 'Divorced', fidelity: 'Analytical', bio: 'Software pioneer and global health philanthropist.' },
  bezos: { age: 60, gender: 'Male', maritalStatus: 'Engaged', fidelity: 'Ambitious', bio: 'E-commerce and aerospace logistics tycoon.' },
  soros: { age: 93, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strategic', bio: 'Reflexivity macro hedge fund trader.' },

  // 2. Crime Syndicate Members
  capone: { age: 48, gender: 'Male', maritalStatus: 'Married', fidelity: 'Syndicate Loyal', bio: 'Chicago Outfit boss. Extortion, bootlegging, and turf control.' },
  luciano: { age: 64, gender: 'Male', maritalStatus: 'Single', fidelity: 'High Romance Risk', bio: 'National Crime Commission architect.' },
  escobar: { age: 44, gender: 'Male', maritalStatus: 'Married', fidelity: 'Protective / Volatile', bio: 'Medellin syndicate boss.' },
  blanco: { age: 43, gender: 'Female', maritalStatus: 'Widowed', fidelity: 'High Romance Risk', bio: 'The Black Widow. Ruthless queenpin of nightlife rackets.' },
  lansky: { age: 81, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'The Mob Accountant. Master of casino skimming.' },

  // 3. US Presidents
  washington: { age: 67, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Founding Commander and advocate for national stability.' },
  lincoln: { age: 56, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Union Preserver and infrastructure champion.' },
  jfk: { age: 46, gender: 'Male', maritalStatus: 'Married', fidelity: 'High Flirtation Risk', bio: 'New Frontier charismatic leader.' },
  reagan: { age: 77, gender: 'Male', maritalStatus: 'Married', fidelity: 'High Loyalty', bio: 'Supply-side tax cut advocate.' },
  fdr: { age: 63, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strategic Alliance', bio: 'New Deal fiscal stimulus architect.' },

  // 4. Federal Reserve & FTC Chairs
  powell: { age: 71, gender: 'Male', maritalStatus: 'Married', fidelity: 'Strictly Faithful', bio: 'Federal Reserve Chairman. Data-dependent monetary controller.' },
  volcker: { age: 91, gender: 'Male', maritalStatus: 'Widowed', fidelity: 'Strictly Faithful', bio: 'The Inflation Slayer. Aggressive rate hike legend.' },
  khan: { age: 35, gender: 'Female', maritalStatus: 'Married', fidelity: 'Dedicated Regulator', bio: 'Neo-Brandeisian FTC Chair pushing tech monopoly breakups.' },
  hoover: { age: 77, gender: 'Male', maritalStatus: 'Single', fidelity: 'Institution Loyal', bio: '1st FBI Director. Pioneer of federal crime wiretaps.' },
  mcnamara: { age: 93, gender: 'Male', maritalStatus: 'Widowed', fidelity: 'Analytical', bio: 'Systems analysis Defense Secretary and Ford executive.' },
}

export function getCharacterBiography(npcId) {
  return CHARACTER_BIOGRAPHIES[npcId] || {
    age: 45,
    gender: 'Male',
    maritalStatus: 'Single',
    fidelity: 'Open to Alliance',
    bio: 'Prominent figure in the Capital Syndicate.',
  }
}
