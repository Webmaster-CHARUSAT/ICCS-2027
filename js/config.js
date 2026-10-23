// Where the website's forms are sent: the Google Apps Script Web App attached to the conference
// spreadsheet (google-apps-script/Code.gs). This URL is public by design — browsers call it
// directly. Access control and validation happen inside the script, not here.
// If you create a NEW deployment (instead of a new version of the existing one), paste its
// /exec URL here.
// cmtUrl: the Microsoft CMT submission site. After registering, authors are sent there to submit
// their abstract. The same URL is linked in index.html (Where & How to Submit, FAQ) — change both.
window.ICCS_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxyEAq9VSj6N9U7gRo03n_c1K-tEaJczVkATC7CZLhnPRpaWDnqjXDVjdCy3CR94hBbYQ/exec',
  cmtUrl: 'https://cmt3.research.microsoft.com/ICCS2027'
};
