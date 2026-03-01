PS Y:\> G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1
[2026-03-01 19:33:18.796] [INFO] Script gestartet. Root-Verzeichnis: G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan
[2026-03-01 19:33:18.943] [INFO] Logdatei: G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\logs\splash-start-20260301-193318.log
[2026-03-01 19:33:19.098] [INFO] Asset-Verzeichnis erkannt: G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan
[2026-03-01 19:33:19.685] [INFO] DLLs erfolgreich geladen.
if : Die Benennung "if" wurde nicht als Name eines Cmdlet, einer Funktion, einer Skriptdatei oder eines ausführbaren
Programms erkannt. Überprüfen Sie die Schreibweise des Namens, oder ob der Pfad korrekt ist (sofern enthalten), und
wiederholen Sie den Vorgang.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:99
Zeichen:24
+ $logoPath = Join-Path (if ($assetRoot) { $assetRoot } else { $root }) ...
+                        ~~
    + CategoryInfo          : ObjectNotFound: (if:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

if : Die Benennung "if" wurde nicht als Name eines Cmdlet, einer Funktion, einer Skriptdatei oder eines ausführbaren
Programms erkannt. Überprüfen Sie die Schreibweise des Namens, oder ob der Pfad korrekt ist (sofern enthalten), und
wiederholen Sie den Vorgang.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:100
Zeichen:24
+ $iconPath = Join-Path (if ($assetRoot) { $assetRoot } else { $root }) ...
+                        ~~
    + CategoryInfo          : ObjectNotFound: (if:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

if : Die Benennung "if" wurde nicht als Name eines Cmdlet, einer Funktion, einer Skriptdatei oder eines ausführbaren
Programms erkannt. Überprüfen Sie die Schreibweise des Namens, oder ob der Pfad korrekt ist (sofern enthalten), und
wiederholen Sie den Vorgang.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:103
Zeichen:28
+ $resourcesDir = Join-Path (if ($assetRoot) { $assetRoot } else { $roo ...
+                            ~~
    + CategoryInfo          : ObjectNotFound: (if:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

Join-Path : Das Argument kann nicht an den Parameter "Path" gebunden werden, da es NULL ist.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:104
Zeichen:24
+ $iconsXaml = Join-Path $resourcesDir "Icons.xaml"
+                        ~~~~~~~~~~~~~
    + CategoryInfo          : InvalidData: (:) [Join-Path], ParameterBindingValidationException
    + FullyQualifiedErrorId : ParameterArgumentValidationErrorNullNotAllowed,Microsoft.PowerShell.Commands.JoinPathCom
   mand

Test-Path : Das Argument kann nicht an den Parameter "Path" gebunden werden, da es NULL ist.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:209
Zeichen:105
+ ... essage) | iconsXaml=$iconsXaml (exists=$(Test-Path $iconsXaml)) | log ...
+                                                        ~~~~~~~~~~
    + CategoryInfo          : InvalidData: (:) [Test-Path], ParameterBindingValidationException
    + FullyQualifiedErrorId : ParameterArgumentValidationErrorNullNotAllowed,Microsoft.PowerShell.Commands.TestPathCom
   mand

[2026-03-01 19:33:20.734] [INFO] XAML erfolgreich geparst.
Es ist nicht möglich, eine Methode für einen Ausdruck aufzurufen, der den NULL hat.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:214
Zeichen:1
+ $window.Add_Loaded({
+ ~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvokeMethodOnNull

Es ist nicht möglich, eine Methode für einen Ausdruck aufzurufen, der den NULL hat.
In G:\o_37_Projekte\o_37_Personalplanungstool\o_37_Personalplanungstool_Wachen\o_37_FRW4\1_Abt\RD-Plan\start.ps1:363
Zeichen:1
+ $window.ShowDialog() | Out-Null
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvokeMethodOnNull
