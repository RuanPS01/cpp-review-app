#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    int N,num;
    double media;
    double soma = 0.0;
    
    cin >> N;
    
    for(int i=0; i<N; i++){
        cin >> num;
        soma += num;
        media = soma/N;
        
    }
    
    
    cout << fixed <<setprecision(4);
    cout << media <<endl;
    
    
    
    
    return 0;
}