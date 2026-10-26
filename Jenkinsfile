pipeline {
    agent any
    
    stages {
        stage('Install') {
            steps {
                sh 'corepack enable && pnpm install --frozen-lockfile --ignore-scripts'
            }
        }

        stage('Lint') {
            steps {
                sh 'pnpm run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm run test'
            }
        }

        stage('Build') {
            steps {
                sh 'pnpm run build'
            }
        }
    }
}   