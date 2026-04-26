#include <iostream>
#include <iomanip>

using namespace std;

int main() {
    
    int N, i;
    double v[1000], soma = 0, media = 0;
    
    cin >> N;
    
    for (i = 0; i < N; i++) {
        
        cin >> v[i];
    }
    
    for (i = 0; i < N; i++) {
        
        soma += v[i];
    }
    
    media = soma / N;
    
    cout << fixed << setprecision(4) << media << endl;
    
    
    return 0;
}