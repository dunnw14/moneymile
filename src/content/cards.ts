import type { CardDef } from '@/types';

/**
 * The 72-card Night Deck: 18 Opportunity, 18 Dirty Trick, 18 Protection,
 * 18 Environment.
 *
 * NOTE ON COPY COUNTS: the v0.4 spec's own catalogue lists copy counts summing
 * to 77, which contradicts its stated 72-card / 18-per-category deck. Every card
 * design in the spec is kept; four duplicate copies were dropped to reach the
 * stated deck size. `copies` is the only knob involved, so restoring the
 * spec's literal numbers is a one-line change per card.
 * See docs/ASSUMPTIONS.md.
 */
export const CARDS: CardDef[] = [
  // =========================================================================
  // OPPORTUNITY (18)
  // =========================================================================
  { id: 'bachelor_party', name: 'Bachelor Party', category: 'opportunity', copies: 2, flavour: 'Twelve men, one wallet, no restraint.', effect: 'One of your Properties earns x2 this Night; +2 Property Heat.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'high_roller', name: 'High Roller', category: 'opportunity', copies: 2, flavour: 'He tips in the currency of his own legend.', effect: 'One of your Workers earns +$150k this Night.', timing: 'scheme', target: 'own_worker', duration: 'This Night' },
  { id: 'payday_weekend', name: 'Payday Weekend', category: 'opportunity', copies: 1, flavour: 'The whole city has money and nowhere to be.', effect: 'All of your Properties earn +20% this Night.', timing: 'scheme', target: 'self', duration: 'This Night' },
  { id: 'packed_house', name: 'Packed House', category: 'opportunity', copies: 1, flavour: 'Standing room only, and the door is still open.', effect: 'Choose: +50% revenue and +2 Heat, or remove 1 Property Heat.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'tourist_bus', name: 'Tourist Bus', category: 'opportunity', copies: 1, flavour: 'Forty people who will never come back. Charge accordingly.', effect: 'One Property gains temporary Capacity +2 for the round.', timing: 'scheme', target: 'own_property', duration: 'This round' },
  { id: 'celebrity_visit', name: 'Celebrity Visit', category: 'opportunity', copies: 1, flavour: 'The photographs are worse than useless. The queue is not.', effect: 'A Licensed Property gains $250k Clean if there is no Raid this Night.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'corporate_function', name: 'Corporate Function', category: 'opportunity', copies: 1, flavour: 'Expensed, itemised, and never spoken of again.', effect: 'Up to three of your Vetted Workers gain +$50k this Night.', timing: 'scheme', target: 'self', duration: 'This Night' },
  { id: 'festival_crowd', name: 'Festival Crowd', category: 'opportunity', copies: 1, flavour: 'The parade ends at your door.', effect: 'One District earns +25% this Night.', timing: 'scheme', target: 'district', duration: 'This Night' },
  { id: 'cash_buyer', name: 'Cash Buyer', category: 'opportunity', copies: 1, flavour: 'No questions, no chain, no delay.', effect: 'Your next Property purchase this turn costs $100k less.', timing: 'scheme', target: 'self', duration: 'This turn' },
  { id: 'recruitment_drive', name: 'Recruitment Drive', category: 'opportunity', copies: 1, flavour: 'Word travels faster than any advertisement.', effect: 'Recruit two Workers with a single Action this turn.', timing: 'scheme', target: 'self', duration: 'This turn' },
  { id: 'renovation_grant', name: 'Renovation Grant', category: 'opportunity', copies: 1, flavour: 'The city would like the street to look respectable.', effect: 'Your next legal Upgrade this turn costs $100k less.', timing: 'scheme', target: 'self', duration: 'This turn' },
  { id: 'fresh_licence', name: 'Fresh Licence', category: 'opportunity', copies: 1, flavour: 'A signature, a stamp, and a different kind of night.', effect: 'Licence a Property for $100k less and remove 1 Heat.', timing: 'scheme', target: 'self', duration: 'This turn' },
  { id: 'loyal_customers', name: 'Loyal Customers', category: 'opportunity', copies: 1, flavour: 'They come for the staff, not the room.', effect: 'A Normal result counts as a Big Night at one Property.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'private_booking', name: 'Private Booking', category: 'opportunity', copies: 1, flavour: 'One party. One price. Agreed in advance.', effect: 'One Property is guaranteed at least Normal revenue this Night.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'new_management', name: 'New Management', category: 'opportunity', copies: 1, flavour: 'The staff notice before the customers do.', effect: 'Hire or move a Mamasan without spending an Action.', timing: 'scheme', target: 'self', duration: 'This turn' },
  { id: 'word_of_mouth', name: 'Word of Mouth', category: 'opportunity', copies: 1, flavour: 'Nobody advertises. Everybody knows.', effect: 'Draw two cards and keep one.', timing: 'immediate', target: 'self', duration: 'Immediate' },

  // =========================================================================
  // DIRTY TRICK (18)
  // =========================================================================
  { id: 'anonymous_tip', name: 'Anonymous Tip', category: 'dirty_trick', copies: 2, flavour: 'A public phone, a quiet voice, a long night for somebody else.', effect: 'Move a Police unit up to two hexes toward a rival.', timing: 'scheme', target: 'police', duration: 'Immediate' },
  { id: 'better_offer', name: 'Better Offer', category: 'dirty_trick', copies: 2, flavour: 'Loyalty has a number. Everyone learns theirs eventually.', effect: 'Attempt to poach an eligible rival Worker.', timing: 'scheme', target: 'rival_worker', duration: 'Immediate' },
  { id: 'noise_complaint', name: 'Noise Complaint', category: 'dirty_trick', copies: 1, flavour: 'The neighbours were always going to break first.', effect: 'A rival Property gains 2 Heat.', timing: 'scheme', target: 'rival_property', duration: 'Immediate' },
  { id: 'new_boyfriend', name: 'New Boyfriend', category: 'dirty_trick', copies: 1, flavour: 'He is very serious about her not working tonight.', effect: 'A rival Worker becomes Unavailable for the round.', timing: 'scheme', target: 'rival_worker', duration: 'This round' },
  { id: 'bad_review', name: 'Bad Review', category: 'dirty_trick', copies: 1, flavour: 'Two stars, four paragraphs, one very determined author.', effect: 'A rival Property earns 25% less this Night.', timing: 'scheme', target: 'rival_property', duration: 'This Night' },
  { id: 'supplier_problem', name: 'Supplier Problem', category: 'dirty_trick', copies: 1, flavour: 'The delivery never arrives and nobody can say why.', effect: 'Disable a Revenue Upgrade at a rival Property.', timing: 'scheme', target: 'rival_property', duration: 'Until repaired' },
  { id: 'licence_challenge', name: 'Licence Challenge', category: 'dirty_trick', copies: 1, flavour: 'Someone has read the paperwork very carefully.', effect: 'A rival Licensed Property is treated as Unlicensed for the round.', timing: 'scheme', target: 'rival_property', duration: 'This round' },
  { id: 'street_blockade', name: 'Street Blockade', category: 'dirty_trick', copies: 1, flavour: 'Roadworks. Indefinite. Unexplained.', effect: 'No Worker may move into or out of a District this round.', timing: 'scheme', target: 'district', duration: 'This round' },
  { id: 'rival_promotion', name: 'Rival Promotion', category: 'dirty_trick', copies: 1, flavour: 'Your crowd, their door.', effect: 'Transfer $100k of expected revenue from a rival Property to yours.', timing: 'scheme', target: 'rival_property', duration: 'This Night' },
  { id: 'inside_information', name: 'Inside Information', category: 'dirty_trick', copies: 1, flavour: 'Someone always talks.', effect: "Inspect a rival's hand and force a random discard.", timing: 'scheme', target: 'rival_player', duration: 'Immediate' },
  { id: 'staff_walkout', name: 'Staff Walkout', category: 'dirty_trick', copies: 1, flavour: 'They have been unhappy for weeks. Tonight it lands.', effect: 'Two Workers at a rival Property become Disrupted.', timing: 'scheme', target: 'rival_property', duration: 'This round' },
  { id: 'protection_demand', name: 'Protection Demand', category: 'dirty_trick', copies: 1, flavour: 'A friendly reminder that the street has an owner.', effect: 'A rival pays you $150k or gains 2 Heat.', timing: 'scheme', target: 'rival_player', duration: 'Immediate' },
  { id: 'fake_booking', name: 'Fake Booking', category: 'dirty_trick', copies: 1, flavour: 'The party of thirty does not exist and never did.', effect: 'Cancel an Opportunity card as it is played.', timing: 'reaction', target: 'rival_player', duration: 'Immediate' },
  { id: 'sabotaged_renovation', name: 'Sabotaged Renovation', category: 'dirty_trick', copies: 1, flavour: 'The wiring was fine yesterday.', effect: 'Disable an Upgrade at a rival Property until repaired.', timing: 'scheme', target: 'rival_property', duration: 'Until repaired' },
  { id: 'territorial_pressure', name: 'Territorial Pressure', category: 'dirty_trick', copies: 1, flavour: 'Everyone pays rent to somebody.', effect: 'Charge a rival $50k for each Property they own in one District.', timing: 'scheme', target: 'rival_player', duration: 'Immediate' },
  { id: 'financial_leak', name: 'Financial Leak', category: 'dirty_trick', copies: 1, flavour: 'A ledger photographed in a stairwell.', effect: 'Add 1 Notoriety to any player holding $1m or more in Dirty Cash.', timing: 'scheme', target: 'board', duration: 'Immediate' },

  // =========================================================================
  // PROTECTION (18)
  // =========================================================================
  { id: 'tip_off', name: 'Tip-Off', category: 'protection', copies: 2, flavour: 'Twenty minutes is all anyone ever needs.', effect: 'Cancel a Raid at one Property; gain 1 Heat.', timing: 'reaction', target: 'own_property', duration: 'Immediate' },
  { id: 'good_lawyer', name: 'Good Lawyer', category: 'protection', copies: 2, flavour: 'Expensive, unhurried, and entirely worth it.', effect: 'Reduce Raid severity by two.', timing: 'reaction', target: 'self', duration: 'Immediate' },
  { id: 'trusted_doorman', name: 'Trusted Doorman', category: 'protection', copies: 1, flavour: 'He remembers every face that ever caused trouble.', effect: 'One Property is immune to Dirty Tricks for the round.', timing: 'scheme', target: 'own_property', duration: 'This round' },
  { id: 'friends_downtown', name: 'Friends Downtown', category: 'protection', copies: 1, flavour: 'A dinner, a favour, a file that moves down the pile.', effect: 'Remove 3 Heat, but not below your Notoriety.', timing: 'scheme', target: 'self', duration: 'Immediate' },
  { id: 'emergency_closure', name: 'Emergency Closure', category: 'protection', copies: 1, flavour: 'Dark windows are the cheapest defence there is.', effect: 'Close one Property; remove 2 Heat from it.', timing: 'scheme', target: 'own_property', duration: 'Until reopened' },
  { id: 'staff_loyalty', name: 'Staff Loyalty', category: 'protection', copies: 1, flavour: 'She has heard better offers before.', effect: 'Cancel a poaching attempt.', timing: 'reaction', target: 'own_worker', duration: 'Immediate' },
  { id: 'insurance_payout', name: 'Insurance Payout', category: 'protection', copies: 1, flavour: 'Slow, partial, and better than nothing.', effect: 'Recover up to $250k Clean after a loss.', timing: 'reaction', target: 'self', duration: 'Immediate' },
  { id: 'clean_books', name: 'Clean Books', category: 'protection', copies: 1, flavour: 'Two ledgers. Only one of them is interesting.', effect: 'Protect $500k Dirty Cash from the Financial Crimes Unit.', timing: 'reaction', target: 'self', duration: 'This round' },
  { id: 'security_sweep', name: 'Security Sweep', category: 'protection', copies: 1, flavour: 'Everything unhelpful leaves by the back door.', effect: 'Remove all negative statuses from your Workers at one Property.', timing: 'scheme', target: 'own_property', duration: 'Immediate' },
  { id: 'diversion', name: 'Diversion', category: 'protection', copies: 1, flavour: 'Something louder is happening two streets away.', effect: 'Redirect a Police unit one adjacent hex.', timing: 'reaction', target: 'police', duration: 'Immediate' },
  { id: 'quiet_week', name: 'Quiet Week', category: 'protection', copies: 1, flavour: 'Nothing happens, deliberately.', effect: 'Remove 2 Heat from a Property; its revenue drops 20% this Night.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'community_support', name: 'Community Support', category: 'protection', copies: 1, flavour: 'The street would rather you stayed.', effect: 'Cancel a Noise Complaint or Licence Challenge.', timing: 'reaction', target: 'self', duration: 'Immediate' },
  { id: 'backup_manager', name: 'Backup Manager', category: 'protection', copies: 1, flavour: 'She has run this room before and will again.', effect: 'One Property operates without a Mamasan this Night.', timing: 'scheme', target: 'own_property', duration: 'This Night' },
  { id: 'locked_safe', name: 'Locked Safe', category: 'protection', copies: 1, flavour: 'Bolted to the floor, and the floor is concrete.', effect: 'Protect $300k of Cash from seizure.', timing: 'reaction', target: 'self', duration: 'This round' },
  { id: 'counteroffer', name: 'Counteroffer', category: 'protection', copies: 1, flavour: 'Matched, and then some.', effect: 'Cancel a poaching attempt and gain $50k.', timing: 'reaction', target: 'own_worker', duration: 'Immediate' },
  { id: 'compliance_review', name: 'Compliance Review', category: 'protection', copies: 1, flavour: 'Voluntary, thorough, and very well publicised.', effect: 'Disable one of your Underworld Upgrades; remove 1 Notoriety.', timing: 'scheme', target: 'own_property', duration: 'Immediate' },

  // =========================================================================
  // ENVIRONMENT (18)
  // =========================================================================
  { id: 'tourist_season', name: 'Tourist Season', category: 'environment', copies: 1, flavour: 'The flights are full and the exchange rate is generous.', effect: 'All revenue +15% this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'city_crackdown', name: 'City Crackdown', category: 'environment', copies: 1, flavour: 'A new commissioner with something to prove.', effect: 'Police movement +1 and Raid chance +3% this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'songkran', name: 'Songkran', category: 'environment', copies: 1, flavour: 'Water, noise, and nobody where they are supposed to be.', effect: 'Big Night revenue +10%; Travellers become Unavailable.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'chinese_new_year', name: 'Chinese New Year', category: 'environment', copies: 1, flavour: 'Red envelopes and very long dinners.', effect: 'Bazaar and Uptown revenue +30% this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'recession', name: 'Recession', category: 'environment', copies: 1, flavour: 'Everyone still comes out. They just spend less.', effect: 'Revenue -20% this round; Properties cost $100k less.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'election_night', name: 'Election Night', category: 'environment', copies: 1, flavour: 'Respectability is briefly fashionable.', effect: 'Licensed revenue +20%; Unlicensed Properties gain 1 Heat.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'monsoon', name: 'Monsoon', category: 'environment', copies: 1, flavour: 'The water comes up the street and stays there.', effect: 'Waterfront revenue -25%; Transit +15% this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'power_failure', name: 'Power Failure', category: 'environment', copies: 1, flavour: 'The grid gives up for six blocks.', effect: 'A random District loses all Upgrade effects this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'police_rotation', name: 'Police Rotation', category: 'environment', copies: 1, flavour: 'New faces, old habits, different streets.', effect: 'Return all Police units to their starting hexes.', timing: 'immediate', target: 'board', duration: 'Immediate' },
  { id: 'new_regulations', name: 'New Regulations', category: 'environment', copies: 1, flavour: 'Another form, another fee.', effect: 'Vetting costs $50k more this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'amnesty_program', name: 'Amnesty Program', category: 'environment', copies: 1, flavour: 'A window that will not stay open long.', effect: 'Vetting costs $50k less for every player this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'property_boom', name: 'Property Boom', category: 'environment', copies: 1, flavour: 'Everyone wants a room on this street.', effect: 'Unsold Properties cost $100k more this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'rental_slump', name: 'Rental Slump', category: 'environment', copies: 1, flavour: 'Landlords would rather have tenants than rent.', effect: 'Property upkeep is waived this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'banking_freeze', name: 'Banking Freeze', category: 'environment', copies: 1, flavour: 'Every account is under review at once.', effect: 'No laundering is possible this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'festival_district', name: 'Festival District', category: 'environment', copies: 1, flavour: 'One street gets everything, all at once.', effect: 'A random District earns +40% and gains 1 Heat this round.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'media_investigation', name: 'Media Investigation', category: 'environment', copies: 1, flavour: 'A journalist with a long memory and a longer deadline.', effect: 'The highest-Notoriety player gains 2 Heat.', timing: 'immediate', target: 'board', duration: 'Immediate' },
  { id: 'public_holiday', name: 'Public Holiday', category: 'environment', copies: 1, flavour: 'Nobody is working tomorrow, so nobody is leaving tonight.', effect: 'Each player chooses one Property to guarantee a Big Night.', timing: 'immediate', target: 'board', duration: 'This round' },
  { id: 'economic_reset', name: 'Economic Reset', category: 'environment', copies: 1, flavour: 'The city exhales.', effect: 'Remove all persistent Environment effects.', timing: 'immediate', target: 'board', duration: 'Immediate' },
];

export const FINAL_RAID_CARD: CardDef = {
  id: 'final_raid',
  name: 'The Final Raid',
  category: 'environment',
  copies: 1,
  flavour: 'Every door on the mile, at the same hour.',
  effect: 'Every player completes one final Night, then a city-wide Raid is resolved.',
  timing: 'immediate',
  target: 'board',
  duration: 'Game end',
};

export const CARD_BY_ID = Object.fromEntries(
  [...CARDS, FINAL_RAID_CARD].map((c) => [c.id, c]),
) as Record<string, CardDef>;

/** Dirty Trick cards count toward the "three aggressive cards in a round" Notoriety trigger. */
export const AGGRESSIVE_CATEGORIES = new Set(['dirty_trick']);

/** The Final Raid card is shuffled into the final N cards of the deck. */
export const FINAL_RAID_WINDOW = 11;
