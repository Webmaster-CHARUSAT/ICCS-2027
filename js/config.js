// Where the website's forms are sent: the Google Apps Script Web App attached to the conference
// spreadsheet (google-apps-script/Code.gs). This URL is public by design — browsers call it
// directly. Access control and validation happen inside the script, not here.
// If you create a NEW deployment (instead of a new version of the existing one), paste its
// /exec URL here.
window.ICCS_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzZVGJBa82aGVkKFSH3C9-Vs_JjJ9YcZttz1EDHIAGKqcdXIMIsebyOIMGDo4aMpKndow/exec'
};
