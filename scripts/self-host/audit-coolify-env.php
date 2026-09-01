<?php
// Run inside the existing Coolify container. Default is read-only.
// --runtime-only applies the documented flags without touching secret values.
require '/var/www/html/vendor/autoload.php';
$framework = require '/var/www/html/bootstrap/app.php';
$framework->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$apply = in_array('--runtime-only', $argv, true);
$app = \App\Models\Application::where('uuid', 'e3qib0s0vmfx7ex10uzea2dh')->firstOrFail();
foreach ($app->environment_variables as $env) {
    if ($apply) {
        $env->is_buildtime = str_starts_with($env->key, 'NEXT_PUBLIC_');
        $env->is_runtime = true;
        $env->is_literal = true;
        $env->save();
    }
    echo json_encode(['key' => $env->key, 'buildtime' => $env->is_buildtime, 'runtime' => $env->is_runtime, 'literal' => $env->is_literal]) . PHP_EOL;
}
