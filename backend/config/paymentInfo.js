// Payment instructions shown to a participant ONLY after their abstract is Accepted — returned
// by POST /api/abstracts/status (see abstractController.status), never embedded in index.html.
// Values are copied verbatim from the conference brochure. Payment itself is handled entirely
// by the university (CHARUSAT): this system only displays how to pay and never tracks,
// verifies or claims to know whether a payment was made.
module.exports = {
  disclaimer: 'Payments are processed directly by Charotar University of Science and Technology. ' +
    'This portal cannot confirm payment status — for payment queries, contact the organizers.',
  indian: {
    title: 'Indian Participants',
    description: 'Pay the registration fee online through the conference payment link.',
    payUrl: 'https://rzp.io/rzp/GT56wXc'
  },
  international: {
    title: 'Participants from Outside India',
    bankDetails: [
      ['Bank A/c Name', 'Charotar University of Science & Technology'],
      ['Bank A/c Number', '30875081005'],
      ['Bank A/c Type', 'Current A/c'],
      ['Bank Branch Address', 'Darshan Hostel, Changa-Valetva Road, Changa, Dist. Anand'],
      ['Bank Branch Code', '10961'],
      ['Bank MICR Code', '388002502'],
      ['Bank IFSC Code', 'SBIN0010961'],
      ['Bank SWIFT Code', 'SBININBB718'],
      ['PAN No', 'AABTC1178Q'],
      ['Bank Telephone No.', '(02692) 248540'],
      ['Bank Email ID', 'sbi10961@sbi.co.in']
    ]
  }
};
