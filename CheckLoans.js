function CheckLoans() {

    // important user variables
    var memberId = '[[Use Member ID Here]]';
    var PIN = '[[Member PIN]]';
    var emailAddress = '[[Email address for alert]]';

    // library details - in this case an id and web service for LibrariesWest
    var libraryId = '280001';
    var libraryUrl = 'http://91.106.192.135/arena.pa.palma/loans';

    // script options:
    // at less than 1 day to go we renew the item
    var daysToRenew = 1;
    // at less than 5 days to go, send an email notification
    var daysToSendEmail = 5;

    // setting up some data for the script
    // includes XML to post to the web service
    var d = new Date();
    var renewals = '';
    var today = new Date();
    var checkLoanPayload = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:loan="http://loans.palma.services.arena.axiell.com/" xmlns:loan1="http://axiell.com/arena/services/palma/patron/loansRequest" xmlns:util="http://axiell.com/arena/services/palma/util"><soapenv:Header/><soapenv:Body><loan:GetLoans><loan1:loansRequest><util:arenaMember>' + libraryId + '</util:arenaMember><util:user>' + memberId + '</util:user><util:password>' + PIN + '</util:password><util:language>en</util:language></loan1:loansRequest></loan:GetLoans></soapenv:Body></soapenv:Envelope>';
    var renewPayload = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:loan="http://loans.palma.services.arena.axiell.com/" xmlns:ren="http://axiell.com/arena/services/palma/patron/renewLoansRequest" xmlns:util="http://axiell.com/arena/services/palma/util" xmlns:loan1="http://axiell.com/arena/services/palma/util/loan"><soapenv:Header/><soapenv:Body><loan:RenewLoans><ren:renewLoansRequest><util:arenaMember>' + libraryId + '</util:arenaMember><util:user>' + memberId + '</util:user><util:password>' + PIN + '</util:password><util:language>en</util:language><ren:loans>[[renewals]]</ren:loans></ren:renewLoansRequest></loan:RenewLoans></soapenv:Body></soapenv:Envelope>';
    var loansOptions = { 'method': 'POST', 'content-type': 'application/xml; charset=utf-8', 'payload': checkLoanPayload };
    var renewOptions = { 'method': 'POST', 'content-type': 'application/xml; charset=utf-8', 'payload': renewPayload };


    // start - get loans data
    var getLoans = UrlFetchApp.fetch('', loansOptions);
    var responseText = getLoans.getContentText();

    // do the XML parsing to get a list of loans
    var docRoot = XmlService.parse(responseText).getRootElement();
    var ns = docRoot.getNamespace();
    var loansRequest = docRoot.getChildren('Body', ns)[0].getChildren()[0].getChildren()[0];
    ns = loansRequest.getNamespace();
    var loans = loansRequest.getChild('loans', ns);
    var loanItems = loans.getChildren();

    var emailText = 'hi libraries hacked,\n';
    var sendEmail = false;
    var renew = false;

    // loop through each loan and construct the email body (if necessary)
    for (var x in loanItems) {
        var loan = loanItems[x];
        ns = loan.getNamespace();
        var renewalDate = loan.getChild('loanDueDate', ns).getText().replace('+', 'T') + ':00.000Z';
        renewalDate = new Date(renewalDate);

        var reservedDate = new Date(loan.getChild('loanDate', ns).getText());
        var branch = loan.getChild('branch', ns).getText();

        var catalogueRecord = loan.getChildren()[1];
        ns = catalogueRecord.getNamespace();

        var title = catalogueRecord.getChild('title', ns).getText();
        var id = catalogueRecord.getChild('id', ns).getText();
        var author = catalogueRecord.getChild('author', ns).getText();
        var oneDay = 1000 * 60 * 60 * 24;
        var dateDifference = Math.ceil((renewalDate.getTime() - today.getTime()) / (oneDay));

        if (dateDifference <= daysToSendEmail) {
            sendEmail = true;
            if (dateDifference <= daysToRenew) {
                // it's so late we need to renew, but say this in the email.
                renew = true;
                emailText += 'items has been renewed ' + title + ', ' + author + ' reserved on ' + reservedDate + '.  remember to finish and return soon.\n';
                renewals += '<loan1:id>' + id + '</loan1:id>'
            }
            else {
                // less than five days to go, will send an email each day.
                emailText += 'your loan of ' + title + ', ' + author + ' reserved on ' + reservedDate + ', is due back on: ' + renewalDate + '.\n';
            }
        }
    }

    // renew whatever items are due to renew
    if (renew) {
        renewPayload = renewPayload.replace('[[renewals]]', renewals);
        UrlFetchApp.fetch(libraryUrl, renewOptions);
    }

    // send out the email
    if (sendEmail) {
        MailApp.sendEmail(emailAddress, 'library notification report', emailText);
    }
}

