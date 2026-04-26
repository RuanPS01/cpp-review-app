#include <iostream>
#include <cmath>
#include <iomanip>

using namespace std;

int main(){
    
    int n, numero;
    float media, soma = 0.0;
    cout << fixed << setprecision(4);
    
    cin >> n;
    
    for(int i = 0; i < n; i++){
        cin >> numero;
        soma = soma + numero;
    }
    
    media = (soma/n);
    
    cout << media << endl;
    
    return 0;
}