param(
    [string]$AppDir = $PSScriptRoot,
    [string]$Personalnummer = $null
)

# ------------------------------
# Setup
# ------------------------------
$root = $AppDir
Write-Host "Script gestartet. Root: $root"

# Personalnummer automatisch aus Environment, falls nicht angegeben
if (-not $Personalnummer) { $Personalnummer = $env:USERNAME }

# DLLs laden
$dllDir = Join-Path $root "assemblies"
$mahAppsDll = Join-Path $dllDir "MahApps.Metro.dll"
$loadingDll = Join-Path $dllDir "LoadingIndicators.WPF.dll"
$interactivityDll = Join-Path $dllDir "System.Windows.Interactivity.dll"

try {
    Add-Type -Path $mahAppsDll
    Add-Type -Path $loadingDll
    Add-Type -Path $interactivityDll
    Add-Type -AssemblyName PresentationFramework
    Add-Type -AssemblyName PresentationCore
    Add-Type -AssemblyName WindowsBase
} catch {
    Write-Error "Failed to load required DLLs. Please ensure they exist in $dllDir"
    exit 1
}

Write-Host "DLLs erfolgreich geladen."

# ------------------------------
# Assets
# ------------------------------
$logoPath = Join-Path $root "media/RD-Plan Logo.gif"
$iconPath = Join-Path $root "media/Icon.ico"
$resourcesDir = Join-Path $root "resources"
$iconsXaml = Join-Path $resourcesDir "Icons.xaml"

# ------------------------------
# Version & EXE Pfad
# ------------------------------
$versionFile = Join-Path $root "version.json"
$appVersion = "1.0.0"

if (Test-Path $versionFile) {
    try {
        $json = Get-Content $versionFile -Raw | ConvertFrom-Json
        if ($json.Version) { $appVersion = $json.Version }
    } catch { Write-Warning "Konnte version.json nicht lesen" }
}

$appExeName = "RD-Plan_$appVersion.exe"
$appPath = Join-Path $root $appExeName

if (-not (Test-Path $appPath)) {
    Write-Error "EXE nicht gefunden: $appPath"
    exit 1
}

Write-Host "Starte: $appPath"

# ------------------------------
# XAML Splashscreen
# ------------------------------
$xaml = @"
<Controls:MetroWindow 
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:Controls="clr-namespace:MahApps.Metro.Controls;assembly=MahApps.Metro"
    xmlns:loadin="clr-namespace:LoadingIndicators.WPF;assembly=LoadingIndicators.WPF"
    WindowStyle="None" WindowStartupLocation="CenterScreen" AllowsTransparency="True" ResizeMode="NoResize"
    Width="500" Height="600" Title="RD-Plan Splash" ShowTitleBar="False"
    BorderThickness="0" GlowBrush="{x:Null}">

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
            <Border Background="White" CornerRadius="20" Padding="30" Margin="0,0,0,40">
                <Border.Effect>
                    <DropShadowEffect BlurRadius="60" ShadowDepth="20" Color="Black" Opacity="0.3"/>
                </Border.Effect>
                <MediaElement Name="LoadingGif" Source="$logoPath" Width="200" Height="200" Stretch="Uniform" LoadedBehavior="Manual" UnloadedBehavior="Manual" />
            </Border>
            <TextBlock Name="StatusText" Text="Initialisiere..." Foreground="White" FontSize="16" TextAlignment="Center" Margin="0,0,0,20"/>
            <loadin:LoadingIndicator Name="ArcsStyle" Style="{DynamicResource LoadingIndicatorArcsStyle}" SpeedRatio="2" Foreground="White" IsActive="True" Margin="0,5,0,0"/>
            <TextBlock Text="$Personalnummer" Foreground="#FFFFFF" Opacity="0.7" FontSize="14" TextAlignment="Center" Margin="0,20,0,0"/>
            <TextBlock Name="VersionText" Text="v$appVersion" Foreground="White" Opacity="0.5" FontSize="12" TextAlignment="Center" Margin="0,10,0,0"/>
        </StackPanel>
    </Grid>
</Controls:MetroWindow>
"@

# ------------------------------
# XAML laden
# ------------------------------
try {
    $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
    $window = [System.Windows.Markup.XamlReader]::Load($reader)
} catch {
    Write-Error "Failed to parse XAML: $_"
    exit 1
}

# ------------------------------
# Splashscreen Logik
# ------------------------------
$window.Add_Loaded({
    $statusText = $window.FindName("StatusText")
    $versionText = $window.FindName("VersionText")
    $gif = $window.FindName("LoadingGif")

    # GIF starten
    if ($gif) { $gif.Play() }

    # Status Helper
    function Update-Status($msg) {
        if ($statusText) { $statusText.Text = $msg }
        Write-Host $msg
        [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke([Action]{}, [System.Windows.Threading.DispatcherPriority]::Render)
    }

    Update-Status "Starte Anwendung..."

    # Anwendung starten
    $proc = Start-Process -FilePath $appPath -ArgumentList "-h$Personalnummer" -PassThru

    # Prozessüberwachung (Timer)
    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(500)
    $timer.Add_Tick({
        if ($proc.HasExited) {
            Write-Host "Prozess beendet. Splash-Screen schließen..."
            $timer.Stop()
            $window.Close()
        }
    })
    $timer.Start()
})

# ------------------------------
# Splash anzeigen
# ------------------------------
$window.ShowDialog() | Out-Null