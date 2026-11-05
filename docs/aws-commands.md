# Running AWS commands for this site

The website lives in AWS account **566078794042**, region **ap-south-1**. The computer used for these commands has two saved AWS profiles. The default one is a different account, so a command without a profile touches the wrong place.

Rules for every command:

1. Always add `--profile strata --region ap-south-1`.
2. First check the account. It must print 566078794042:
   `aws sts get-caller-identity --profile strata --query Account --output text`
3. After saving a setting, list the names to confirm it is there (names only, never values):
   `aws ssm describe-parameters --profile strata --region ap-south-1 --query "Parameters[].Name" --output text`
4. In PowerShell, save output files to `$env:TEMP\...`, not the current folder (System32 is write-protected).
5. Never paste keys or passwords into chat. Type them into the command yourself.

The website's Lambda functions read settings from `/alamo-web/...` and cache them for 5 minutes, so wait that long after saving a setting before testing.
