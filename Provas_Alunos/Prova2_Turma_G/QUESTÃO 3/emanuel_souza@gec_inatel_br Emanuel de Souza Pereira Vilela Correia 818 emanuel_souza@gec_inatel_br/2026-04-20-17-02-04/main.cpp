#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    
    int N;
    double soma = 0;
    double media;
    
    while (cin >> N && N != 0){
        
        for (int i = 0; i < N; i++){
            soma += N;
            N++;
            
            media = soma / N;
        }
    }
    
    cout << fixed << setprecision (2) << media << endl;
    
    return 0;
}