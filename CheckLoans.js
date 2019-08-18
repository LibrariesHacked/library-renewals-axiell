function CheckLoans() {

  // user acount details - put your user number, PIN, and email address
  var id = '';
  var pin = '';
  var email = '';
 
  // library details - in this case an ID and URL for Wiltshire but fill with your own if using an Axiell system
  var library_id = '400001';
  var library_url = 'https://libraries.wiltshire.gov.uk/arena.pa.palma/loans';
  
  // at less than 1 day to go, renew the item
  var renewal_days = 1;
  // at less than 5 days to go, send an email notification
  var email_days = 5;
  
  // setting up some data for the script
  var renewals = '';
  var today = new Date();
  var check_loan_payload = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:loan="http://loans.palma.services.arena.axiell.com/" xmlns:loan1="http://axiell.com/arena/services/palma/patron/loansRequest" xmlns:util="http://axiell.com/arena/services/palma/util"><soapenv:Header/><soapenv:Body><loan:GetLoans><loan1:loansRequest><util:arenaMember>' + library_id + '</util:arenaMember><util:user>' + id + '</util:user><util:password>' + pin + '</util:password><util:language>en</util:language></loan1:loansRequest></loan:GetLoans></soapenv:Body></soapenv:Envelope>';
  var renew_payload = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:loan="http://loans.palma.services.arena.axiell.com/" xmlns:ren="http://axiell.com/arena/services/palma/patron/renewLoansRequest" xmlns:util="http://axiell.com/arena/services/palma/util" xmlns:loan1="http://axiell.com/arena/services/palma/util/loan"><soapenv:Header/><soapenv:Body><loan:RenewLoans><ren:renewLoansRequest><util:arenaMember>' + library_id + '</util:arenaMember><util:user>' + id + '</util:user><util:password>' + pin + '</util:password><util:language>en</util:language><ren:loans>[[renewals]]</ren:loans></ren:renewLoansRequest></loan:RenewLoans></soapenv:Body></soapenv:Envelope>';
  var check_loan_options = { 'method':'POST', 'content-type': 'application/xml; charset=utf-8', 'payload': check_loan_payload };
  
  // start - get loans data
  var get_loans = UrlFetchApp.fetch(library_url, check_loan_options);
  var response = get_loans.getContentText();
  Logger.log(response);
  
  // do the XML parsing to get a list of loans
  var doc_root = XmlService.parse(response).getRootElement();
  var namespace = doc_root.getNamespace();
  var loans_request = doc_root.getChildren('Body', namespace)[0].getChildren()[0].getChildren()[0];
  namespace = loans_request.getNamespace();
  var loans = loans_request.getChild('loans', namespace);
  var loan_items = loans.getChildren();
  
  var send_email = false;
  var renew = false;
  var email_content = 'Hi Hacked,\n';
  // loop through each loan and construct the email body (if necessary)
  for (var x in loan_items) {
    var loan = loan_items[x];
    namespace = loan.getNamespace();
    var renewal_date = loan.getChild('loanDueDate',namespace).getText().replace('+','T') + ':00.000Z';
    renewal_date = new Date(renewal_date);
    
    // When the loan was issued
    var loan_date = loan.getChild('loanDate',namespace).getText().replace('+','T') + ':00.000Z';
    loan_date = new Date(loan_date);
    // Which branch it was issued in
    var branch = loan.getChild('branch', namespace).getText();
    // ID (for renewing).
    var item_id = loan.getChild('id', namespace).getText();
    
    var catalogue_record = loan.getChildren()[1];
    namespace = catalogue_record.getNamespace();
    
    // Also get author and title
    var title = catalogue_record.getChild('title', namespace).getText();
    var author = catalogue_record.getChild('author', namespace).getText();
    
    var one_day_milliseconds = 1000 * 60 * 60 * 24; // Number of milliseconds in a day
    var date_difference = Math.ceil((renewal_date.getTime() - today.getTime())/(one_day_milliseconds));
    
    if (date_difference <= email_days) {
      send_email = true;
      if (date_difference <= renewal_days) {
        // we need to renew, but also say this in the email.
        renew = true;
        email_content += 'Renewing item ' + title + ' by ' + author + ' . You borrowed this ' + loan_date + '.  Please finish and return soon.\n';
        renewals += '<loan1:id>' + item_id + '</loan1:id>'
      }
      else {
        // less than five days to go, will send an email each day.
        email_content += 'Loan of ' + title + ', ' + author + ' loaned on ' + loan_date + ', is due back on ' + renewal_date + '. \n';
      }
    }
  }

  // Then renew the items that are due
  if (renew) {
    renew_payload = renew_payload.replace('[[renewals]]', renewals);
    var renew_options = { 'method':'POST', 'content-type': 'application/xml; charset=utf-8', 'payload': renew_payload };
    var renew_request = UrlFetchApp.fetch(library_url, renew_options);
    var renew_result = renew_request.getContentText();
    email_content += 'Success? ' + renew_result
  }

  // send out the email
  if (send_email) {
    MailApp.sendEmail(email, 'Library renewal notification', email_content);
  }
}
