function prefixPatterns (prefix, patterns = []) {
    return patterns.map((pattern) => `${prefix}/${pattern}`);
}

function scopeConfigs (prefix, configs) {
    return configs.slice(1).map((config) => {
        const scopedConfig = {
            ...config,
            files: prefixPatterns(prefix, config.files),
        };

        if (config.ignores) {
            scopedConfig.ignores = prefixPatterns(prefix, config.ignores);
        }

        return scopedConfig;
    });
}

module.exports = [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/.turbo/**',
        ],
    },
    ...scopeConfigs(
        'packages/account-abstraction',
        require('./packages/account-abstraction/eslint.config.cjs')
    ),
    ...scopeConfigs('packages/core-sdk', require('./packages/core-sdk/eslint.config.cjs')),
    ...scopeConfigs('packages/crypto', require('./packages/crypto/eslint.config.cjs')),
    ...scopeConfigs('packages/stellar', require('./packages/stellar/eslint.config.cjs')),
    ...scopeConfigs('packages/types', require('./packages/types/eslint.config.cjs')),
    ...scopeConfigs('packages/ui-kit', require('./packages/ui-kit/eslint.config.cjs')),
];
