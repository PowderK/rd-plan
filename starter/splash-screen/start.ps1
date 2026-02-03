
# Get the script root directory
# Get the script root directory
$root = $PSScriptRoot
Write-Host "Script gestartet. Root-Verzeichnis: $root"

 

# Paths to DLLs (Relative to this script)
$dllDir = Join-Path $root "assemblies"
$mahAppsDll = Join-Path $dllDir "MahApps.Metro.dll"
$loadingDll = Join-Path $dllDir "LoadingIndicators.WPF.dll"
$interactivityDll = Join-Path $dllDir "System.Windows.Interactivity.dll"

# Load Assemblies
try {
    Add-Type -Path $mahAppsDll
    Add-Type -Path $loadingDll
    Add-Type -Path $interactivityDll
    Add-Type -AssemblyName PresentationFramework
    Add-Type -AssemblyName PresentationCore
    Add-Type -AssemblyName WindowsBase
}

catch {
    Write-Error "Failed to load required DLLs. Please ensure they exist in $dllDir"
    exit 1
}
Write-Host "DLLs erfolgreich geladen."

# Image Paths (Relative to this script)
$logoPath = Join-Path $root "media/RD-Plan Logo.gif"
$iconPath = Join-Path $root "media/Icon.ico"

# Resource Path for Icons.xaml (Relative to this script)
$resourcesDir = Join-Path $root "resources"
$iconsXaml = Join-Path $resourcesDir "Icons.xaml"

# Define XAML
$xaml = @"
<Controls:MetroWindow 
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:Controls="clr-namespace:MahApps.Metro.Controls;assembly=MahApps.Metro"
    xmlns:loadin="clr-namespace:LoadingIndicators.WPF;assembly=LoadingIndicators.WPF"
    WindowStyle="None" 
    WindowStartupLocation="CenterScreen"  
    AllowsTransparency="True" 
    ResizeMode="NoResize"
    Width="500" 
    Height="600"
    Title="RD-Plan Splash"
    ShowTitleBar="False"

    BorderThickness="0"
    GlowBrush="{x:Null}">

    <Window.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingWave.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingThreeDots.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingFlipPlane.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingPulse.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingDoubleBounce.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingArcs.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Colors.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles.xaml"/>
                
                <ResourceDictionary Source="$iconsXaml" />
                
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Controls.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Fonts.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Colors.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Accents/Cobalt.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Accents/BaseLight.xaml" />
            </ResourceDictionary.MergedDictionaries>
        </ResourceDictionary>
    </Window.Resources>

    <Window.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
            <GradientStop Color="#1e3a8a" Offset="0.0"/>
            <GradientStop Color="#3b82f6" Offset="1.0"/>
        </LinearGradientBrush>
    </Window.Background>

    <Grid>
        <StackPanel VerticalAlignment="Center" HorizontalAlignment="Center">
            
            <!-- Logo Container (White Box) -->
            <Border Background="White" CornerRadius="20" Padding="30" Margin="0,0,0,40">
                <Border.Effect>
                    <DropShadowEffect BlurRadius="60" ShadowDepth="20" Color="Black" Opacity="0.3"/>
                </Border.Effect>
                <MediaElement Name="LoadingGif" Source="$logoPath" Width="200" Height="200" Stretch="Uniform" LoadedBehavior="Play" UnloadedBehavior="Manual" ScrubbingEnabled="True" RenderOptions.BitmapScalingMode="HighQuality" />
            </Border>

            <!-- Loading Text -->
            <TextBlock Name="StatusText"
                       Text="Initialisiere..." 
                       Foreground="White" 
                       FontSize="16" 
                       FontWeight="Normal" 
                       TextAlignment="Center" 
                       Margin="0,0,0,20"/>
                       
            <!-- Loading Indicator -->
             <loadin:LoadingIndicator Name="ArcsStyle" 
                                     Style="{DynamicResource LoadingIndicatorArcsStyle}"
                                     SpeedRatio="2" 
                                     Foreground="White" 
                                     IsActive="True" 
                                     Margin="0,5,0,0"/>

             <TextBlock Text="$env:USERNAME" 
                       Foreground="#FFFFFF" 
                       Opacity="0.7"
                       FontSize="14" 
                       TextAlignment="Center" 
                       Margin="0,20,0,0"/>

             <!-- Version -->
             <TextBlock Name="VersionText"
                       Text="v..."
                       Foreground="White"
                       Opacity="0.5"
                       FontSize="12"
                       TextAlignment="Center"
                       Margin="0,10,0,0"/>
        </StackPanel>
    </Grid>
</Controls:MetroWindow>
"@

# Parse XAML
try {
    $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
    $window = [System.Windows.Markup.XamlReader]::Load($reader)
}
catch {
    Write-Error "Failed to parse XAML: $_"
    exit 1
}
Write-Host "XAML erfolgreich geparst."

$window.Add_Loaded({
    # Logic to run after window opens
    Write-Host "Splash-Screen Fenster geladen."

    # UI Elements setup
    $statusText = $window.FindName("StatusText")
    $versionText = $window.FindName("VersionText")
    

    
    # Helper to update status (and pump events slightly to ensure redraw if busy)
    function Update-Status($msg) {
        if ($statusText) {
            $statusText.Text = $msg
            # Force UI update (simple method)
            [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke([Action]{}, [System.Windows.Threading.DispatcherPriority]::Render)
        }
        Write-Host $msg
    }

    Update-Status "Lade Animation..."
    
    # --- Version and Config Loading (Moved for Speed) ---
    Update-Status "Lade Version..."
    # Small UI refresh
    [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke([Action]{}, [System.Windows.Threading.DispatcherPriority]::Background)

    $versionFile = Join-Path $root "version.json"
    $appVersion = "1.0.0" # Default fallback
    
    if (Test-Path $versionFile) {
        try {
            $json = Get-Content $versionFile -Raw | ConvertFrom-Json
            if ($json.Version) {
                $appVersion = $json.Version
            }
        } catch {
            Write-Warning "Could not read version.json"
        }
    }
    Write-Host "Erkannte Version: $appVersion"
    
    if ($versionText) {
        $versionText.Text = "v$appVersion"
    }
    
    # Calculate AppPath with loaded version
    $appPath = Join-Path $root "../../RD-Plan_$appVersion.exe" 
    # ----------------------------------------------------
    
    # Enable looping for the GIF
    $gif = $window.FindName("LoadingGif")
    if ($gif) {
        $gif.Add_MediaEnded({
            param($sender, $e)
            $sender.Position = [TimeSpan]::Zero
            $sender.Play()
        })
    }
    
    # Get Username
    $username = $env:USERNAME

    # --- Database Check ---
    Update-Status "Prüfe Datenbank-Konfiguration..."
    $dbConfigFile = Join-Path $root "db-config.json"
    if (Test-Path $dbConfigFile) {
        try {
            Write-Host "Lese $dbConfigFile..."
            $dbConfig = Get-Content $dbConfigFile -Raw | ConvertFrom-Json
            if ($dbConfig.dbDir) {
                $dbPath = Join-Path $dbConfig.dbDir "rd-plan.db"
                Update-Status "Prüfe Datenbank: $dbPath"
                # Small delay to let user see the message
                Start-Sleep -Milliseconds 500 
                
                if (-not (Test-Path $dbPath)) {
                    Update-Status "FEHLER: Datenbank nicht gefunden!"
                    Write-Error "Datenbank nicht gefunden!"
                    [System.Windows.MessageBox]::Show("Datenbank nicht gefunden:`n$dbPath`n`nBitte prüfen Sie die Konfiguration.", "Fehler", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
                    $window.Close()
                    return
                }
                Update-Status "Datenbank gefunden."
            }
        } catch {
             Write-Warning "Konnte db-config.json nicht lesen: $_"
             Update-Status "Warnung: Config-Fehler"
        }
    } else {
        Update-Status "Keine Konfiguration gefunden (Standard)"
        Write-Host "Keine db-config.json gefunden. Überspringe Datenbank-Check."
    }
    # ----------------------
    
    # Start RD-Plan using the configured variable
    # If the configured path doesn't exist, try to fallback or just fail
    
    if (Test-Path $appPath) {
        Update-Status "Starte Anwendung..."
        Write-Host "Starte Anwendung: $appPath"
        Start-Process -FilePath $appPath -ArgumentList "-h$username"
    }
    elseif (Test-Path "npm") {
        # Dev fallback if appPath is invalid but we are in dev (and npm is in path)
        # Assuming current dir or root (try to find package.json up)
        $packageJson = Join-Path $root "../../package.json"
        if (Test-Path $packageJson) {
             Update-Status "Starte via NPM..."
             Write-Host "Starte via NPM (Dev Mode)..."
             Start-Process -FilePath "npm" -ArgumentList "start", "--", "-h$username" -WorkingDirectory (Split-Path $packageJson)
        } else {
             Write-Host "Executable not found at $appPath and npm not ready."
        }
    }
    else {
        Write-Host "Executable not found at $appPath"
    }

    # Start a timer to check for process start
    Update-Status "Warte auf Prozess..."
    Write-Host "Warte auf Prozessstart..."
    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(500)
    $timer.Add_Tick({
        param($sender, $e)
        
        $proc = Get-Process -Name "RD-Plan" -ErrorAction SilentlyContinue
        $procElectron = Get-Process -Name "electron" -ErrorAction SilentlyContinue
        
        if ($proc -or $procElectron) {
            Write-Host "Prozess erkannt. Schließe Splash-Screen..."
            $sender.Stop()
            Start-Sleep -Seconds 3
            $window.Close()
        }
    })
    $timer.Start()
})

# Show Window
$window.ShowDialog() | Out-Null
