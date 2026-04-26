#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    int N, numero;
    double soma = 0, media;
    
    cin >> N;
    
    for (int i = 0; i < N; i++){
        cin >> numero;
        
        soma = soma + numero;
    }
    
    media = soma * 1.0 / N;
    
    cout << fixed << setprecision(4)<< media << endl;
    
    return 0;
}